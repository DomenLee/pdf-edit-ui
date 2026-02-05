import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { getOverlays, getPdfById, saveOverlays } from "../storage/pdfStorage";
import {
  getPageViewport,
  loadPdfPage,
  renderPage,
  renderPageForColorSampling,
  renderPathLayerForPage,
  renderStampLayerForPage,
  renderTextLayerForPage,
} from "../core/pdf/pdfRenderer";
import { Canvas } from "../ui/Canvas";
import { Toolbar } from "../ui/Toolbar";
import { useOverlayStore } from "../state/overlayStore";
import { useI18nStore } from "../i18n/i18nStore";
import { exportHtmlToPdf } from "../core/export/htmlToPdf";

export const EditorPage = () => {
  const { id } = useParams();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const pathLayerRef = useRef<HTMLDivElement | null>(null);
  const stampLayerRef = useRef<HTMLDivElement | null>(null);
  const [statusKey, setStatusKey] = useState("editor.status.loading");
  const [pageSize, setPageSize] = useState({ width: 0, height: 0, scale: 1 });
  const [zoomScale, setZoomScale] = useState(1);
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
    let cancelled = false;
    const load = async () => {
      if (cancelled) {
        return;
      }
      setStatusKey("editor.status.loading");
      if (!documentId) {
        setStatusKey("editor.status.missingId");
        return;
      }

      if (!canvasRef.current || !textLayerRef.current || !pathLayerRef.current || !stampLayerRef.current) {
        setStatusKey("editor.status.canvasNotReady");
        requestAnimationFrame(() => {
          if (!cancelled) {
            void load();
          }
        });
        return;
      }

      const entry = await getPdfById(documentId);
      if (!entry) {
        setStatusKey("editor.status.missingPdf");
        return;
      }

      try {
        const page = await loadPdfPage(entry.data, 1);
        const scale = 1.1;
        const viewport = getPageViewport(page, scale);
        setPageSize({ width: viewport.width, height: viewport.height, scale });
        const colorSampling = await renderPageForColorSampling(page, scale);
        await renderPage(page, canvasRef.current, scale);
        await renderPathLayerForPage(page, pathLayerRef.current, scale);
        await renderStampLayerForPage(page, stampLayerRef.current, scale);
        await renderTextLayerForPage(page, textLayerRef.current, scale, colorSampling.context);
        textLayerRef.current.setAttribute("contenteditable", "true");
        const spans = textLayerRef.current.querySelectorAll("span");
        spans.forEach((span, index) => {
          span.dataset.textId = span.dataset.textId ?? `text-${index}`;
          span.dataset.pageIndex = "0";
          if (!span.dataset.originalText) {
            span.dataset.originalText = span.textContent ?? "";
          }

          const role = span.dataset.textRole === "data" ? "data" : "template";
          span.dataset.textRole = role;
          span.contentEditable = role === "data" ? "true" : "false";
          span.classList.toggle("is-template-text", role === "template");
        });
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
    return () => {
      cancelled = true;
    };
  }, [documentId, initializeOverlays]);


  useEffect(() => {
    if (!documentId) {
      return;
    }
    setDocumentId(documentId);
    void saveOverlays(documentId, overlays, []);
  }, [documentId, overlays, setDocumentId]);

  const handleExport = async () => {
    if (!documentId) {
      return;
    }
    const textLayer = textLayerRef.current;
    const pathLayer = pathLayerRef.current;
    if (!textLayer || !pathLayer) {
      return;
    }

    await exportHtmlToPdf({
      filename: `${documentId}-edited.pdf`,
      textLayer,
      pathLayer,
      viewportScale: pageSize.scale || 1,
      overlays,
    });
  };


  const handleZoomIn = () => {
    setZoomScale((prev) => Math.min(2.5, Number((prev + 0.1).toFixed(2))));
  };

  const handleZoomOut = () => {
    setZoomScale((prev) => Math.max(0.5, Number((prev - 0.1).toFixed(2))));
  };

  const handleZoomReset = () => {
    setZoomScale(1);
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
        <Toolbar
          onExport={handleExport}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onZoomReset={handleZoomReset}
          zoomPercent={Math.round(zoomScale * 100)}
        />
        <div className="editor-body">
          <Canvas
            canvasRef={canvasRef}
            textLayerRef={textLayerRef}
            pathLayerRef={pathLayerRef}
            stampLayerRef={stampLayerRef}
            status={t(statusKey)}
            width={pageSize.width}
            height={pageSize.height}
            zoomPercent={Math.round(zoomScale * 100)}
            zoomScale={zoomScale}
          />
        </div>
      </div>
    </div>
  );
};
