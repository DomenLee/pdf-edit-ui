import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { getOverlays, getPdfById, saveOverlays } from "../storage/pdfStorage";
import {
  loadPdfPage,
  renderPage,
  renderTextLayerForPage,
  renderPathLayerForPage,
} from "../core/pdf/pdfRenderer";
import { Sidebar } from "../ui/Sidebar";
import { PropertyPanel } from "../ui/PropertyPanel";
import { Canvas } from "../ui/Canvas";
import { Toolbar } from "../ui/Toolbar";
import { useOverlayStore } from "../state/overlayStore";
import { useI18nStore } from "../i18n/i18nStore";
import { exportPdf } from "../core/export/pdfExport";
import { EditedTextItem } from "../overlay/objects/types";
import { useTextLayerStore } from "../state/textLayerStore";

export const EditorPage = () => {
  const { id } = useParams();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const pathLayerRef = useRef<HTMLDivElement | null>(null);
  const [statusKey, setStatusKey] = useState("editor.status.loading");
  const [editingMode, setEditingMode] = useState(false);
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
  const editedTextItems = useTextLayerStore((state) => state.editedTextItems);
  const setEditedTextItems = useTextLayerStore(
    (state) => state.setEditedTextItems,
  );
  const setActiveEditingTextId = useTextLayerStore(
    (state) => state.setActiveEditingTextId,
  );
  const upsertEditedTextItem = useTextLayerStore(
    (state) => state.upsertEditedTextItem,
  );

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
        const scale = 1.1;
        const renderResult = await renderPage(page, canvasRef.current, scale);
        setPageSize(renderResult);
        const baseViewport = page.getViewport({ scale: 1 });
        setPdfPageSize({
          width: baseViewport.width,
          height: baseViewport.height,
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
          const legacy = (overlayEntry as {
            nativeTextReplacements?: EditedTextItem[];
          }).nativeTextReplacements;
          const nextItems = (overlayEntry.editedTextItems ?? legacy ?? []).map(
            (item) => ({
              ...item,
              bbox:
                (item as { bbox?: EditedTextItem["bbox"] }).bbox ??
                (item as { originalBBox?: EditedTextItem["bbox"] }).originalBBox ?? {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                },
            }),
          );
          setEditedTextItems(nextItems);
        } else {
          initializeOverlays([]);
          setEditedTextItems([]);
        }
        setStatusKey("editor.status.renderComplete");
      } catch (error) {
        console.error(error);
        setStatusKey("editor.status.renderFailed");
      }
    };

    void load();
  }, [documentId, initializeOverlays, setEditedTextItems]);

  useEffect(() => {
    const renderEditLayers = async () => {
      if (
        !editingMode ||
        !textLayerRef.current ||
        !pathLayerRef.current ||
        !documentId
      ) {
        return;
      }
      const entry = await getPdfById(documentId);
      if (!entry) {
        return;
      }
      const page = await loadPdfPage(entry.data, 1);
      const scale = pageSize.scale || 1.1;
      await renderTextLayerForPage(page, textLayerRef.current, scale);
      await renderPathLayerForPage(page, pathLayerRef.current, scale);
      const spans = textLayerRef.current.querySelectorAll("span");
      spans.forEach((span, index) => {
        span.dataset.textId = span.dataset.textId ?? `text-${index}`;
        span.dataset.pageIndex = "0";
        if (!span.dataset.originalText) {
          span.dataset.originalText = span.textContent ?? "";
        }
        span.contentEditable = "false";
      });
    };

    if (editingMode) {
      void renderEditLayers();
      return;
    }

    if (textLayerRef.current) {
      textLayerRef.current.innerHTML = "";
    }
    if (pathLayerRef.current) {
      pathLayerRef.current.innerHTML = "";
    }
    setActiveEditingTextId(null);
  }, [documentId, editingMode, pageSize.scale, setActiveEditingTextId]);

  useEffect(() => {
    if (!documentId) {
      return;
    }
    setDocumentId(documentId);
    void saveOverlays(documentId, overlays, editedTextItems);
  }, [documentId, overlays, editedTextItems, setDocumentId]);

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
      editedTextItems,
      pageSize,
      filename: `${documentId}-edited.pdf`,
    });
  };

  const activeSpanRef = useRef<HTMLSpanElement | null>(null);

  const commitSpan = (span: HTMLSpanElement) => {
    const container = textLayerRef.current;
    if (!container) {
      return;
    }
    const textId = span.dataset.textId;
    if (!textId) {
      return;
    }
    const replacementText = span.innerText;
    const originalText = span.dataset.originalText ?? span.innerText;
    const rect = span.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const bbox = {
      x: rect.left - containerRect.left,
      y: rect.top - containerRect.top,
      width: rect.width,
      height: rect.height,
    };
    const scale = pageSize.scale || 1;
    const fontSize = Number.parseFloat(
      window.getComputedStyle(span).fontSize || "12",
    );
    const item: EditedTextItem = {
      id: textId,
      pageIndex: 0,
      originalText,
      replacementText,
      bbox: {
        x: bbox.x / scale,
        y: pdfPageSize.height
          ? pdfPageSize.height - (bbox.y + bbox.height) / scale
          : bbox.y / scale,
        width: bbox.width / scale,
        height: bbox.height / scale,
      },
      fontSize: fontSize / scale,
    };
    upsertEditedTextItem(item);
    span.contentEditable = "false";
    span.classList.remove("is-editing");
    setActiveEditingTextId(null);
    activeSpanRef.current = null;
  };

  const enterEditMode = (span: HTMLSpanElement) => {
    span.contentEditable = "true";
    span.classList.add("is-editing");
    span.focus();
    const range = document.createRange();
    range.selectNodeContents(span);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    const handleBlur = () => commitSpan(span);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commitSpan(span);
      }
    };
    span.addEventListener("blur", handleBlur, { once: true });
    span.addEventListener("keydown", handleKeyDown, { once: true });
  };

  useEffect(() => {
    const container = textLayerRef.current;
    if (!container || !editingMode) {
      return;
    }

    const replacementMap = new Map(
      editedTextItems.map((item) => [item.id, item]),
    );

    container.querySelectorAll("span[data-text-id]").forEach((node) => {
      const span = node as HTMLSpanElement;
      if (span.isContentEditable) {
        return;
      }
      const replacement = replacementMap.get(span.dataset.textId ?? "");
      if (replacement) {
        span.textContent = replacement.replacementText;
      } else if (span.dataset.originalText) {
        span.textContent = span.dataset.originalText;
      }
    });
  }, [editedTextItems, editingMode]);

  useEffect(() => {
    const container = textLayerRef.current;
    if (!container || !editingMode) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const span = target?.closest("span") as HTMLSpanElement | null;
      if (!span || !span.dataset.textId) {
        return;
      }
      if (span.isContentEditable) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (activeSpanRef.current && activeSpanRef.current !== span) {
        commitSpan(activeSpanRef.current);
      }
      activeSpanRef.current = span;
      setActiveEditingTextId(span.dataset.textId ?? null);
      enterEditMode(span);
    };

    container.addEventListener("mousedown", handlePointerDown);
    return () => container.removeEventListener("mousedown", handlePointerDown);
  }, [editingMode, setActiveEditingTextId]);

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
          editingMode={editingMode}
          onToggleEditingMode={() => setEditingMode((prev) => !prev)}
        />
        <div className="editor-body">
          <Sidebar />
          <Canvas
            canvasRef={canvasRef}
            textLayerRef={textLayerRef}
            pathLayerRef={pathLayerRef}
            editingMode={editingMode}
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
