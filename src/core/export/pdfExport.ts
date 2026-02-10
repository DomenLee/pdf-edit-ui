import { PDFDocument, rgb } from "pdf-lib";
import { EditedTextItem, OverlayObject } from "../../overlay/objects/types";

type ExportOptions = {
  data: ArrayBuffer;
  overlays: OverlayObject[];
  editedTextItems?: EditedTextItem[];
  svgPaths?: Array<{
    d: string;
    fill: string;
    stroke: string;
    strokeWidth: string;
  }>;
  filename: string;
};

const parseHexColor = (hex: string) => {
  const value = hex.replace("#", "");
  const r = Number.parseInt(value.slice(0, 2), 16) / 255;
  const g = Number.parseInt(value.slice(2, 4), 16) / 255;
  const b = Number.parseInt(value.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
};

export const exportPdf = async ({
  data,
  overlays,
  editedTextItems = [],
  svgPaths = [],
  filename,
}: ExportOptions) => {
  const pdfDoc = await PDFDocument.load(data);
  const page = pdfDoc.getPage(0);
  const { height: pdfHeight } = page.getSize();

  overlays
    .filter((overlay) => overlay.pageIndex === 0)
    .forEach((overlay) => {
      if (overlay.type === "text") {
        const fontSize = overlay.style?.fontSize ?? 16;
        const color = overlay.style?.color ?? "#111827";
        page.drawText(overlay.content ?? "", {
          x: overlay.x,
          y: pdfHeight - (overlay.y + overlay.height),
          size: fontSize,
          color: parseHexColor(color),
        });
      }

      if (overlay.type === "highlight") {
        const color = overlay.style?.color ?? "#fde047";
        const opacity = overlay.style?.opacity ?? 0.5;
        page.drawRectangle({
          x: overlay.x,
          y: pdfHeight - (overlay.y + overlay.height),
          width: overlay.width,
          height: overlay.height,
          color: parseHexColor(color),
          opacity,
        });
      }
    });

  editedTextItems
    .filter((item) => item.pageIndex === 0)
    .forEach((item) => {
      const text = item.replacementText.trim();
      if (!text) {
        return;
      }
      page.drawRectangle({
        x: item.bbox.x,
        y: item.bbox.y,
        width: item.bbox.width,
        height: item.bbox.height,
        color: rgb(1, 1, 1),
        opacity: 1,
      });
      page.drawText(text, {
        x: item.bbox.x,
        y: item.bbox.y,
        size: item.fontSize ?? 12,
        color: parseHexColor("#111827"),
      });
    });

  const parseSvgColor = (value: string) => {
    if (!value || value === "none") {
      return null;
    }
    if (value.startsWith("#")) {
      return parseHexColor(value);
    }
    const rgbMatch = value.match(/rgba?\\(([^)]+)\\)/);
    if (rgbMatch) {
      const parts = rgbMatch[1].split(",").map((part) => Number.parseFloat(part.trim()));
      const [r, g, b] = parts;
      if ([r, g, b].every((v) => Number.isFinite(v))) {
        return { r: r / 255, g: g / 255, b: b / 255 };
      }
    }
    return parseHexColor("#111827");
  };

  svgPaths.forEach((path) => {
    if (!path.d) {
      return;
    }
    const fill = parseSvgColor(path.fill);
    const stroke = parseSvgColor(path.stroke);
    const strokeWidth = Number.parseFloat(path.strokeWidth || "1");
    page.drawSvgPath(path.d, {
      color: fill ?? undefined,
      borderColor: stroke ?? undefined,
      borderWidth: Number.isFinite(strokeWidth) ? strokeWidth : undefined,
    });
  });

  const bytes = await pdfDoc.save();
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};
