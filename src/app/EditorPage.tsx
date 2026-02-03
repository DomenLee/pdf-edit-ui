import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { PDFDocument, rgb } from "pdf-lib";
import { getOverlays, getPdfById, saveOverlays } from "../storage/pdfStorage";
import { loadPdfPage, renderPage } from "../core/pdf/pdfRenderer";
import { EditorToolbar } from "../ui/EditorToolbar";
import { Sidebar } from "../ui/Sidebar";
import { PropertyPanel } from "../ui/PropertyPanel";
import { CanvasStage } from "../ui/CanvasStage";
import { useEditorStore } from "../state/editorStore";
import { OverlayItem } from "../overlay/types";

export const EditorPage = () => {
  const { id } = useParams();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState("加载中...");
  const [pageSize, setPageSize] = useState({ width: 0, height: 0, scale: 1 });
  const documentId = useMemo(() => id ?? "", [id]);
  const overlays = useEditorStore((state) => state.overlays);
  const initializeOverlays = useEditorStore((state) => state.initializeOverlays);

  useEffect(() => {
    const load = async () => {
      if (!documentId) {
        setStatus("缺少文档 ID。");
        return;
      }

      const entry = await getPdfById(documentId);
      if (!entry) {
        setStatus("未找到对应 PDF。");
        return;
      }

      if (!canvasRef.current) {
        setStatus("Canvas 未准备好。");
        return;
      }

      try {
        const page = await loadPdfPage(entry.data, 1);
        const viewport = await renderPage(page, canvasRef.current, 1.1);
        setPageSize(viewport);
        const overlayEntry = await getOverlays(documentId);
        if (overlayEntry) {
          initializeOverlays(overlayEntry.overlays);
        } else {
          initializeOverlays([]);
        }
        setStatus("渲染完成。");
      } catch (error) {
        console.error(error);
        setStatus("渲染失败。");
      }
    };

    void load();
  }, [documentId]);

  useEffect(() => {
    if (!documentId) {
      return;
    }
    void saveOverlays(documentId, overlays);
  }, [documentId, overlays]);

  const handleExport = async () => {
    if (!documentId) {
      return;
    }
    const entry = await getPdfById(documentId);
    if (!entry) {
      return;
    }
    const pdfDoc = await PDFDocument.load(entry.data);
    const page = pdfDoc.getPage(0);
    const { width: pdfWidth, height: pdfHeight } = page.getSize();
    const scaleX = pageSize.width ? pdfWidth / pageSize.width : 1;
    const scaleY = pageSize.height ? pdfHeight / pageSize.height : 1;

    const parseHexColor = (hex: string) => {
      const value = hex.replace("#", "");
      const r = Number.parseInt(value.slice(0, 2), 16) / 255;
      const g = Number.parseInt(value.slice(2, 4), 16) / 255;
      const b = Number.parseInt(value.slice(4, 6), 16) / 255;
      return rgb(r, g, b);
    };

    overlays.forEach((overlay) => {
      if (overlay.type === "text") {
        page.drawText(overlay.text, {
          x: overlay.x * scaleX,
          y: pdfHeight - (overlay.y + overlay.height) * scaleY,
          size: overlay.fontSize * scaleY,
          color: parseHexColor(overlay.color),
        });
      }
      if (overlay.type === "highlight") {
        page.drawRectangle({
          x: overlay.x * scaleX,
          y: pdfHeight - (overlay.y + overlay.height) * scaleY,
          width: overlay.width * scaleX,
          height: overlay.height * scaleY,
          color: parseHexColor(overlay.color),
          opacity: overlay.opacity,
        });
      }
    });

    const bytes = await pdfDoc.save();
    const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${documentId}-edited.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="editor-shell">
      <div className="editor-layout">
        <EditorToolbar onExport={handleExport} />
        <div className="editor-body">
          <Sidebar />
          <CanvasStage
            canvasRef={canvasRef}
            status={status}
            width={pageSize.width}
            height={pageSize.height}
          />
          <PropertyPanel />
        </div>
      </div>
    </div>
  );
};
