import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { getOverlays, getPdfById, saveOverlays } from "../storage/pdfStorage";
import { loadPdfPage, renderPage } from "../core/pdf/pdfRenderer";
import { Sidebar } from "../ui/Sidebar";
import { PropertyPanel } from "../ui/PropertyPanel";
import { Canvas } from "../ui/Canvas";
import { Toolbar } from "../ui/Toolbar";
import { useOverlayStore } from "../state/overlayStore";
import { useI18nStore } from "../i18n/i18nStore";
import { exportPdf } from "../core/export/pdfExport";

export const EditorPage = () => {
  const { id } = useParams();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [statusKey, setStatusKey] = useState("editor.status.loading");
  const [pageSize, setPageSize] = useState({ width: 0, height: 0, scale: 1 });
  const documentId = useMemo(() => id ?? "", [id]);
  const overlays = useOverlayStore((state) => state.overlays);
  const initializeOverlays = useOverlayStore(
    (state) => state.initializeOverlays,
  );
  const setDocumentId = useOverlayStore((state) => state.setDocumentId);
  const undo = useOverlayStore((state) => state.undo);
  const redo = useOverlayStore((state) => state.redo);
  const selectedId = useOverlayStore((state) => state.selectedId);
  const deleteOverlay = useOverlayStore((state) => state.deleteOverlay);
  const { t } = useI18nStore((state) => ({
    t: state.t,
    locale: state.locale,
  }));

  useEffect(() => {
    const load = async () => {
      setStatusKey("editor.status.loading");
      if (!documentId) {
        setStatusKey("editor.status.missingId");
        return;
      }

      const entry = await getPdfById(documentId);
      if (!entry) {
        setStatusKey("editor.status.missingPdf");
        return;
      }

      if (!canvasRef.current) {
        setStatusKey("editor.status.canvasNotReady");
        return;
      }

      try {
        const page = await loadPdfPage(entry.data, 1);
        const viewport = await renderPage(page, canvasRef.current, 1.1);
        setPageSize(viewport);
        const overlayEntry = await getOverlays(documentId);
        if (overlayEntry) {
          const normalized = overlayEntry.overlays.map((overlay) => {
            if (overlay.type === "text") {
              return {
                ...overlay,
                pageIndex: overlay.pageIndex ?? 0,
                content: overlay.content ?? (overlay as { text?: string }).text ?? "",
                style: overlay.style ?? {
                  fontSize:
                    (overlay as { fontSize?: number }).fontSize ?? 16,
                  color: (overlay as { color?: string }).color ?? "#111827",
                },
              };
            }
            return {
              ...overlay,
              pageIndex: overlay.pageIndex ?? 0,
              style: overlay.style ?? {
                color: (overlay as { color?: string }).color ?? "#fde047",
                opacity: (overlay as { opacity?: number }).opacity ?? 0.5,
              },
            };
          });
          initializeOverlays(normalized);
        } else {
          initializeOverlays([]);
        }
        setStatusKey("editor.status.renderComplete");
      } catch (error) {
        console.error(error);
        setStatusKey("editor.status.renderFailed");
      }
    };

    void load();
  }, [documentId, initializeOverlays]);

  useEffect(() => {
    if (!documentId) {
      return;
    }
    setDocumentId(documentId);
    void saveOverlays(documentId, overlays);
  }, [documentId, overlays, setDocumentId]);

  const handleExport = async () => {
    if (!documentId) {
      return;
    }
    const entry = await getPdfById(documentId);
    if (!entry) {
      return;
    }
    await exportPdf({
      data: entry.data,
      overlays,
      pageSize,
      filename: `${documentId}-edited.pdf`,
    });
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isEditableTarget =
        event.target instanceof HTMLElement &&
        (event.target.isContentEditable ||
          event.target.tagName === "INPUT" ||
          event.target.tagName === "TEXTAREA");

      if (isEditableTarget) {
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      if (event.key === "Delete" && selectedId) {
        event.preventDefault();
        deleteOverlay(selectedId);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteOverlay, redo, selectedId, undo]);

  return (
    <div className="editor-shell">
      <div className="editor-layout">
        <Toolbar onExport={handleExport} />
        <div className="editor-body">
          <Sidebar />
          <Canvas
            canvasRef={canvasRef}
            status={t(statusKey)}
            width={pageSize.width}
            height={pageSize.height}
          />
          <PropertyPanel />
        </div>
      </div>
    </div>
  );
};
