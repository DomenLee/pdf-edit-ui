import { PDFDocument, rgb } from "pdf-lib";
import { OverlayObject } from "../../overlay/objects/types";

type ExportOptions = {
  data: ArrayBuffer;
  overlays: OverlayObject[];
  pageSize: {
    width: number;
    height: number;
  };
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
  pageSize,
  filename,
}: ExportOptions) => {
  const pdfDoc = await PDFDocument.load(data);
  const page = pdfDoc.getPage(0);
  const { width: pdfWidth, height: pdfHeight } = page.getSize();
  const scaleX = pageSize.width ? pdfWidth / pageSize.width : 1;
  const scaleY = pageSize.height ? pdfHeight / pageSize.height : 1;

  overlays
    .filter((overlay) => overlay.pageIndex === 0)
    .forEach((overlay) => {
      if (overlay.type === "text") {
        const fontSize = overlay.style?.fontSize ?? 16;
        const color = overlay.style?.color ?? "#111827";
        page.drawText(overlay.content ?? "", {
          x: overlay.x * scaleX,
          y: pdfHeight - (overlay.y + overlay.height) * scaleY,
          size: fontSize * scaleY,
          color: parseHexColor(color),
        });
      }

      if (overlay.type === "highlight") {
        const color = overlay.style?.color ?? "#fde047";
        const opacity = overlay.style?.opacity ?? 0.5;
        page.drawRectangle({
          x: overlay.x * scaleX,
          y: pdfHeight - (overlay.y + overlay.height) * scaleY,
          width: overlay.width * scaleX,
          height: overlay.height * scaleY,
          color: parseHexColor(color),
          opacity,
        });
      }
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
