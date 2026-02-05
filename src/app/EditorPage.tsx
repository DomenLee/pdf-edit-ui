import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { getOverlays, getPdfById, saveOverlays } from "../storage/pdfStorage";
import {
  getPageViewport,
  loadPdfPage,
  renderPathLayerForPage,
  renderTextLayerForPage,
} from "../core/pdf/pdfRenderer";
import { Sidebar } from "../ui/Sidebar";
import { PropertyPanel } from "../ui/PropertyPanel";
import { Canvas } from "../ui/Canvas";
import { Toolbar } from "../ui/Toolbar";
import { useOverlayStore } from "../state/overlayStore";
import { useI18nStore } from "../i18n/i18nStore";
import { exportPdf } from "../core/export/pdfExport";
import type { EditedTextItem } from "../overlay/objects/types";

export const EditorPage = () => {
  const { id } = useParams();
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const pathLayerRef = useRef<HTMLDivElement | null>(null);
  const [statusKey, setStatusKey] = useState("editor.status.loading");
  const [pageSize, setPageSize] = useState({ width: 0, height: 0, scale: 1 });
  const [pdfPageSize, setPdfPageSize] = useState({ width: 0, height: 0 });
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

      if (!textLayerRef.current || !pathLayerRef.current) {
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
        const baseViewport = page.getViewport({ scale: 1 });
        setPdfPageSize({
          width: baseViewport.width,
          height: baseViewport.height,
        });
        await renderTextLayerForPage(page, textLayerRef.current, scale);
        await renderPathLayerForPage(page, pathLayerRef.current, scale);
        const spans = textLayerRef.current.querySelectorAll("span");
        spans.forEach((span, index) => {
          span.dataset.textId = span.dataset.textId ?? `text-${index}`;
          span.dataset.pageIndex = "0";
          if (!span.dataset.originalText) {
            span.dataset.originalText = span.textContent ?? "";
          }
          span.contentEditable = "true";
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
    const entry = await getPdfById(documentId);
    if (!entry) {
      return;
    }
    const textLayer = textLayerRef.current;
    const pathLayer = pathLayerRef.current;
    if (!textLayer || !pathLayer) {
      return;
    }
    const containerRect = textLayer.getBoundingClientRect();
    const scale = pageSize.scale || 1;
    const textItems = Array.from(textLayer.querySelectorAll("span")).map(
      (span, index) => {
        const rect = span.getBoundingClientRect();
        const fontSize = Number.parseFloat(
          window.getComputedStyle(span).fontSize || "12",
        );
        const text = span.textContent ?? "";
        return {
          id: span.dataset.textId ?? `text-${index}`,
          pageIndex: 0,
          originalText: span.dataset.originalText ?? text,
          replacementText: text,
          bbox: {
            x: (rect.left - containerRect.left) / scale,
            y: pdfPageSize.height
              ? pdfPageSize.height - (rect.top - containerRect.top + rect.height) / scale
              : (rect.top - containerRect.top) / scale,
            width: rect.width / scale,
            height: rect.height / scale,
          },
          fontSize: fontSize / scale,
        };
      },
    );
    const svgPaths = Array.from(pathLayer.querySelectorAll("path")).map(
      (path) => ({
        d: path.getAttribute("d") ?? "",
        fill: path.getAttribute("fill") ?? "none",
        stroke: path.getAttribute("stroke") ?? "none",
        strokeWidth: path.getAttribute("stroke-width") ?? "1",
      }),
    );
    await exportPdf({
      data: entry.data,
      overlays,
      editedTextItems: textItems,
      svgPaths,
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
            textLayerRef={textLayerRef}
            pathLayerRef={pathLayerRef}
            status={t(statusKey)}
            width={pageSize.width}
            height={pageSize.height}
            zoomPercent={Math.round(pageSize.scale * 100)}
          />
          <PropertyPanel />
        </div>
      </div>
    </div>
  );
};
