import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { OverlayObject } from "../../overlay/objects/types";

type HtmlToPdfOptions = {
  filename: string;
  textLayer: HTMLDivElement;
  pathLayer: HTMLDivElement;
  viewportScale: number;
  overlays?: OverlayObject[];
};

type RgbColor = { r: number; g: number; b: number };

const clampColor = (value: number) => Math.min(1, Math.max(0, value));

const parseColor = (raw: string | null | undefined): RgbColor | null => {
  if (!raw || raw === "none" || raw === "transparent") {
    return null;
  }

  const value = raw.trim().toLowerCase();
  if (value.startsWith("#")) {
    const hex = value.slice(1);
    const full =
      hex.length === 3
        ? `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`
        : hex;
    if (full.length !== 6) {
      return null;
    }
    const r = Number.parseInt(full.slice(0, 2), 16) / 255;
    const g = Number.parseInt(full.slice(2, 4), 16) / 255;
    const b = Number.parseInt(full.slice(4, 6), 16) / 255;
    if ([r, g, b].some((item) => Number.isNaN(item))) {
      return null;
    }
    return { r: clampColor(r), g: clampColor(g), b: clampColor(b) };
  }

  const match = value.match(/rgba?\(([^)]+)\)/);
  if (!match) {
    return null;
  }

  const [r = "0", g = "0", b = "0"] = match[1].split(",").map((part) => part.trim());
  const red = Number.parseFloat(r) / 255;
  const green = Number.parseFloat(g) / 255;
  const blue = Number.parseFloat(b) / 255;
  if ([red, green, blue].some((item) => Number.isNaN(item))) {
    return null;
  }
  return { r: clampColor(red), g: clampColor(green), b: clampColor(blue) };
};

const toPdfColor = (value: RgbColor | null, fallback: RgbColor) =>
  rgb(value?.r ?? fallback.r, value?.g ?? fallback.g, value?.b ?? fallback.b);

const triggerDownload = (bytes: Uint8Array, filename: string) => {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const format = (value: number) => Number(value.toFixed(3));

const convertPathToPdf = (d: string, pageHeight: number, scale: number) => {
  const tokenRegex = /([MLCQHVZmlcqhvz])|(-?\d*\.?\d+(?:e[-+]?\d+)?)/g;
  const tokens: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = tokenRegex.exec(d)) !== null) {
    tokens.push(match[0]);
  }

  let index = 0;
  let currentX = 0;
  let currentY = 0;
  let currentCmd = "";
  const output: string[] = [];

  const nextNumber = () => {
    const token = tokens[index];
    index += 1;
    return Number.parseFloat(token);
  };

  while (index < tokens.length) {
    const token = tokens[index];
    if (/^[MLCQHVZmlcqhvz]$/.test(token)) {
      currentCmd = token;
      index += 1;
      if (currentCmd === "Z" || currentCmd === "z") {
        output.push("Z");
      }
      continue;
    }

    switch (currentCmd) {
      case "M":
      case "L": {
        const x = nextNumber();
        const y = nextNumber();
        currentX = x;
        currentY = y;
        output.push(
          `${currentCmd} ${format(currentX / scale)} ${format((pageHeight - currentY) / scale)}`,
        );
        break;
      }
      case "m":
      case "l": {
        const dx = nextNumber();
        const dy = nextNumber();
        currentX += dx;
        currentY += dy;
        output.push(
          `${currentCmd.toUpperCase()} ${format(currentX / scale)} ${format((pageHeight - currentY) / scale)}`,
        );
        break;
      }
      case "H": {
        currentX = nextNumber();
        output.push(`L ${format(currentX / scale)} ${format((pageHeight - currentY) / scale)}`);
        break;
      }
      case "h": {
        currentX += nextNumber();
        output.push(`L ${format(currentX / scale)} ${format((pageHeight - currentY) / scale)}`);
        break;
      }
      case "V": {
        currentY = nextNumber();
        output.push(`L ${format(currentX / scale)} ${format((pageHeight - currentY) / scale)}`);
        break;
      }
      case "v": {
        currentY += nextNumber();
        output.push(`L ${format(currentX / scale)} ${format((pageHeight - currentY) / scale)}`);
        break;
      }
      case "C": {
        const x1 = nextNumber();
        const y1 = nextNumber();
        const x2 = nextNumber();
        const y2 = nextNumber();
        const x = nextNumber();
        const y = nextNumber();
        currentX = x;
        currentY = y;
        output.push(
          `C ${format(x1 / scale)} ${format((pageHeight - y1) / scale)} ${format(x2 / scale)} ${format((pageHeight - y2) / scale)} ${format(x / scale)} ${format((pageHeight - y) / scale)}`,
        );
        break;
      }
      case "Q": {
        const x1 = nextNumber();
        const y1 = nextNumber();
        const x = nextNumber();
        const y = nextNumber();
        currentX = x;
        currentY = y;
        output.push(
          `Q ${format(x1 / scale)} ${format((pageHeight - y1) / scale)} ${format(x / scale)} ${format((pageHeight - y) / scale)}`,
        );
        break;
      }
      default:
        index += 1;
        break;
    }
  }

  return output.join(" ");
};

export const exportHtmlToPdf = async ({
  filename,
  textLayer,
  pathLayer,
  viewportScale,
  overlays = [],
}: HtmlToPdfOptions) => {
  const scale = viewportScale || 1;
  const pageRect = textLayer.getBoundingClientRect();
  const pageWidth = pageRect.width / scale;
  const pageHeight = pageRect.height / scale;

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([pageWidth, pageHeight]);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const svgPaths = Array.from(pathLayer.querySelectorAll("path"));
  svgPaths.forEach((pathEl) => {
    const originalPath = pathEl.getAttribute("d") ?? "";
    if (!originalPath.trim()) {
      return;
    }

    const pdfPath = convertPathToPdf(originalPath, pageRect.height, scale);
    const strokeWidthValue = Number.parseFloat(pathEl.getAttribute("stroke-width") ?? "1");
    const strokeWidth = Number.isFinite(strokeWidthValue) ? strokeWidthValue / scale : 1;

    const fill = parseColor(pathEl.getAttribute("fill"));
    const stroke = parseColor(pathEl.getAttribute("stroke"));

    page.drawSvgPath(pdfPath, {
      color: fill ? toPdfColor(fill, { r: 0, g: 0, b: 0 }) : undefined,
      borderColor: stroke ? toPdfColor(stroke, { r: 0, g: 0, b: 0 }) : undefined,
      borderWidth: strokeWidth,
    });
  });

  const textNodes = Array.from(textLayer.querySelectorAll("span, div"));
  textNodes.forEach((node) => {
    const text = node.textContent ?? "";
    if (!text.trim()) {
      return;
    }

    const rect = node.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return;
    }

    const styles = window.getComputedStyle(node);
    const fontSizePx = Number.parseFloat(styles.fontSize || "12");
    const fontSize = Number.isFinite(fontSizePx) ? fontSizePx / scale : 12;
    const color = parseColor(styles.color);

    const x = (rect.left - pageRect.left) / scale;
    const y = pageHeight - (rect.top - pageRect.top + rect.height) / scale;

    page.drawText(text, {
      x,
      y,
      size: fontSize,
      color: toPdfColor(color, { r: 0.07, g: 0.09, b: 0.12 }),
      font: helvetica,
    });
  });

  overlays
    .filter((overlay) => overlay.pageIndex === 0)
    .forEach((overlay) => {
      const x = overlay.x / scale;
      const width = overlay.width / scale;
      const height = overlay.height / scale;
      const y = pageHeight - (overlay.y + overlay.height) / scale;

      if (overlay.type === "highlight") {
        const color = parseColor(overlay.style?.color ?? "#fde047");
        page.drawRectangle({
          x,
          y,
          width,
          height,
          color: toPdfColor(color, { r: 0.99, g: 0.88, b: 0.28 }),
          opacity: overlay.style?.opacity ?? 0.5,
        });
      }

      if (overlay.type === "text") {
        const text = overlay.content ?? "";
        if (!text.trim()) {
          return;
        }
        const color = parseColor(overlay.style?.color ?? "#111827");
        const size = (overlay.style?.fontSize ?? 16) / scale;
        page.drawText(text, {
          x,
          y,
          size,
          color: toPdfColor(color, { r: 0.07, g: 0.09, b: 0.12 }),
          font: helvetica,
        });
      }
    });

  const bytes = await pdfDoc.save();
  triggerDownload(bytes, filename);
};
