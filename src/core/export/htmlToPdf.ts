import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { OverlayObject } from "../../overlay/objects/types";

type HtmlToPdfOptions = {
  filename: string;
  textLayer: HTMLDivElement;
  pathLayer: HTMLDivElement;
  viewportScale: number;
  overlays?: OverlayObject[];
  sourcePdfData?: ArrayBuffer;
};

type RgbColor = { r: number; g: number; b: number };

const EXPORT_FONT_CANDIDATES = [
  "/fonts/NotoSansSC-Regular.ttf",
  "/fonts/NotoSansSC-Medium.ttf",
  "/standard_fonts/NotoSansSC-Regular.ttf",
  "/standard_fonts/NotoSansSC-Medium.ttf",
  "/standard_fonts/LiberationSans-Regular.ttf",
];

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

  const [r = "0", g = "0", b = "0"] = match[1]
    .split(",")
    .map((part) => part.trim());
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
        output.push(
          `L ${format(currentX / scale)} ${format((pageHeight - currentY) / scale)}`,
        );
        break;
      }
      case "h": {
        currentX += nextNumber();
        output.push(
          `L ${format(currentX / scale)} ${format((pageHeight - currentY) / scale)}`,
        );
        break;
      }
      case "V": {
        currentY = nextNumber();
        output.push(
          `L ${format(currentX / scale)} ${format((pageHeight - currentY) / scale)}`,
        );
        break;
      }
      case "v": {
        currentY += nextNumber();
        output.push(
          `L ${format(currentX / scale)} ${format((pageHeight - currentY) / scale)}`,
        );
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

const isWinAnsiEncodeError = (error: unknown) =>
  error instanceof Error && error.message.includes("WinAnsi cannot encode");

const fontByteCache = new Map<string, Uint8Array | null>();

const loadFontBytes = async (url: string) => {
  if (fontByteCache.has(url)) {
    return fontByteCache.get(url) ?? null;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      fontByteCache.set(url, null);
      return null;
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    fontByteCache.set(url, bytes);
    return bytes;
  } catch {
    fontByteCache.set(url, null);
    return null;
  }
};

const getCustomFont = async (pdfDoc: PDFDocument) => {
  const registerFontkit = (pdfDoc as any).registerFontkit as
    | ((kit: unknown) => void)
    | undefined;
  const fontkit = (window as Window & { fontkit?: unknown }).fontkit;

  if (!registerFontkit || !fontkit) {
    return null;
  }

  registerFontkit(fontkit);

  for (const path of EXPORT_FONT_CANDIDATES) {
    const fontBytes = await loadFontBytes(path);
    if (!fontBytes) {
      continue;
    }

    try {
      return await pdfDoc.embedFont(fontBytes, { subset: true });
    } catch {
      continue;
    }
  }

  return null;
};

const canEncodeWithFont = (font: any, text: string) => {
  if (!font) {
    return false;
  }

  try {
    font.encodeText(text);
    return true;
  } catch {
    return false;
  }
};

const toCanvasColor = (color: RgbColor | null, fallback: RgbColor) => {
  const target = color ?? fallback;
  return `rgb(${Math.round(target.r * 255)}, ${Math.round(target.g * 255)}, ${Math.round(target.b * 255)})`;
};

const drawTextAsPng = async ({
  pdfDoc,
  page,
  text,
  x,
  y,
  size,
  color,
}: {
  pdfDoc: PDFDocument;
  page: any;
  text: string;
  x: number;
  y: number;
  size: number;
  color: RgbColor | null;
}) => {
  const fallbackColor = { r: 0.07, g: 0.09, b: 0.12 };
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Failed to create canvas context for text export fallback.");
  }

  context.font = `${size}px sans-serif`;
  const metrics = context.measureText(text);
  const width = Math.max(1, Math.ceil(metrics.width));
  const height = Math.max(1, Math.ceil(size * 1.4));

  canvas.width = width;
  canvas.height = height;

  context.clearRect(0, 0, width, height);
  context.font = `${size}px sans-serif`;
  context.fillStyle = toCanvasColor(color, fallbackColor);
  context.textBaseline = "alphabetic";
  context.fillText(text, 0, size);

  const dataUrl = canvas.toDataURL("image/png");
  const response = await fetch(dataUrl);
  const imageBytes = new Uint8Array(await response.arrayBuffer());
  const image = await pdfDoc.embedPng(imageBytes);
  page.drawImage(image, {
    x,
    y,
    width,
    height,
  });
};

const drawTextWithFallback = async ({
  pdfDoc,
  page,
  text,
  x,
  y,
  size,
  color,
  primaryFont,
  customFont,
}: {
  pdfDoc: PDFDocument;
  page: any;
  text: string;
  x: number;
  y: number;
  size: number;
  color: RgbColor | null;
  primaryFont: any;
  customFont: any;
}) => {
  const fallbackColor = { r: 0.07, g: 0.09, b: 0.12 };

  const preferredFonts = [customFont, primaryFont].filter(Boolean);
  for (const font of preferredFonts) {
    if (!canEncodeWithFont(font, text)) {
      continue;
    }

    page.drawText(text, {
      x,
      y,
      size,
      color: toPdfColor(color, fallbackColor),
      font,
    });
    return;
  }

  try {
    page.drawText(text, {
      x,
      y,
      size,
      color: toPdfColor(color, fallbackColor),
      font: primaryFont,
    });
    return;
  } catch (error) {
    if (!isWinAnsiEncodeError(error)) {
      throw error;
    }
  }

  await drawTextAsPng({
    pdfDoc,
    page,
    text,
    x,
    y,
    size,
    color,
  });
};

export const exportHtmlToPdf = async ({
  filename,
  textLayer,
  pathLayer,
  viewportScale,
  overlays = [],
  sourcePdfData,
}: HtmlToPdfOptions) => {
  const viewport = viewportScale || 1;
  const pageRect = textLayer.getBoundingClientRect();
  const fallbackWidth = pageRect.width / viewport;
  const fallbackHeight = pageRect.height / viewport;
  const layerWidth = textLayer.clientWidth || pageRect.width;
  const layerHeight = textLayer.clientHeight || pageRect.height;

  const pdfDoc = sourcePdfData
    ? await PDFDocument.load(sourcePdfData)
    : await PDFDocument.create();
  const page = sourcePdfData
    ? pdfDoc.getPage(0)
    : pdfDoc.addPage([fallbackWidth, fallbackHeight]);

  const { width: pdfPageWidth, height: pdfPageHeight } = page.getSize();
  const xRatio = pdfPageWidth / pageRect.width;
  const yRatio = pdfPageHeight / pageRect.height;
  const overlayXRatio = pdfPageWidth / (layerWidth || 1);
  const overlayYRatio = pdfPageHeight / (layerHeight || 1);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const customFont = await getCustomFont(pdfDoc);

  const textNodes = Array.from(
    textLayer.querySelectorAll<HTMLElement>(
      'span[data-text-role="data"], div[data-text-role="data"]',
    ),
  );

  if (!sourcePdfData) {
    const svgPaths = Array.from(pathLayer.querySelectorAll("path"));
    const pathScale = viewport * (layerHeight > 0 ? pageRect.height / layerHeight : 1);

    for (const pathEl of svgPaths) {
      const originalPath = pathEl.getAttribute("d") ?? "";
      if (!originalPath.trim()) {
        continue;
      }

      const pdfPath = convertPathToPdf(originalPath, pageRect.height, pathScale);
      const strokeWidthValue = Number.parseFloat(
        pathEl.getAttribute("stroke-width") ?? "1",
      );
      const strokeWidth = Number.isFinite(strokeWidthValue)
        ? strokeWidthValue / pathScale
        : 1;

      const fill = parseColor(pathEl.getAttribute("fill"));
      const stroke = parseColor(pathEl.getAttribute("stroke"));

      page.drawSvgPath(pdfPath, {
        color: fill ? toPdfColor(fill, { r: 0, g: 0, b: 0 }) : undefined,
        borderColor: stroke ? toPdfColor(stroke, { r: 0, g: 0, b: 0 }) : undefined,
        borderWidth: strokeWidth,
      });
    }

    for (const node of textNodes) {
      const text = node.textContent ?? "";
      if (!text.trim()) {
        continue;
      }

      const rect = node.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        continue;
      }

      const styles = window.getComputedStyle(node);
      const fontSizePx = Number.parseFloat(styles.fontSize || "12");
      const fontSize = Number.isFinite(fontSizePx) ? fontSizePx / viewport : 12;
      const color = parseColor(styles.color);

      const x = (rect.left - pageRect.left) * xRatio;
      const y =
        pdfPageHeight -
        (rect.top - pageRect.top + rect.height) * yRatio;

      await drawTextWithFallback({
        pdfDoc,
        page,
        text,
        x,
        y,
        size: fontSize,
        color,
        primaryFont: helvetica,
        customFont,
      });
    }
  }

  for (const overlay of overlays.filter((item) => item.pageIndex === 0)) {
    const x = overlay.x * overlayXRatio;
    const width = overlay.width * overlayXRatio;
    const height = overlay.height * overlayYRatio;
    const y = pdfPageHeight - (overlay.y + overlay.height) * overlayYRatio;

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
        continue;
      }
      const color = parseColor(overlay.style?.color ?? "#111827");
      const size = (overlay.style?.fontSize ?? 16) / viewport;
      await drawTextWithFallback({
        pdfDoc,
        page,
        text,
        x,
        y,
        size,
        color,
        primaryFont: helvetica,
        customFont,
      });
    }
  }

  if (sourcePdfData) {
    for (const node of textNodes) {
      const currentText = node.textContent ?? "";
      const originalText = node.dataset.originalText ?? "";
      if (currentText.trim() === originalText.trim()) {
        continue;
      }

      const rect = node.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        continue;
      }

      const styles = window.getComputedStyle(node);
      const fontSizePx = Number.parseFloat(styles.fontSize || "12");
      const fontSize = Number.isFinite(fontSizePx) ? fontSizePx / viewport : 12;
      const color = parseColor(styles.color);

      const x = (rect.left - pageRect.left) * xRatio;
      const y =
        pdfPageHeight -
        (rect.top - pageRect.top + rect.height) * yRatio;
      const width = rect.width * xRatio;
      const height = rect.height * yRatio;

      page.drawRectangle({
        x,
        y,
        width,
        height,
        color: rgb(1, 1, 1),
      });

      await drawTextWithFallback({
        pdfDoc,
        page,
        text: currentText,
        x,
        y,
        size: fontSize,
        color,
        primaryFont: helvetica,
        customFont,
      });
    }
  }

  const bytes = await pdfDoc.save();
  triggerDownload(bytes, filename);
};
