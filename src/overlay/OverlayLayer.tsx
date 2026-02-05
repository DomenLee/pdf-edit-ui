import { useMemo, useState } from "react";
import { OverlayObject } from "./objects/types";
import { useToolStore } from "../state/toolStore";
import { useOverlayStore } from "../state/overlayStore";
import { cn } from "../components/ui/utils";
import { useI18nStore } from "../i18n/i18nStore";

type OverlayLayerProps = {
  width: number;
  height: number;
};

type HighlightDraft = {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
};

export const OverlayLayer = ({ width, height }: OverlayLayerProps) => {
  const overlays = useOverlayStore((state) => state.overlays);
  const selectedId = useOverlayStore((state) => state.selectedId);
  const addOverlay = useOverlayStore((state) => state.addOverlay);
  const updateOverlay = useOverlayStore((state) => state.updateOverlay);
  const updateOverlayLive = useOverlayStore((state) => state.updateOverlayLive);
  const commitHistory = useOverlayStore((state) => state.commitHistory);
  const setSelectedId = useOverlayStore((state) => state.setSelectedId);
  const clearSelected = useOverlayStore((state) => state.clearSelected);
  const activeTool = useToolStore((state) => state.activeTool);
  const { t } = useI18nStore((state) => ({
    t: state.t,
    locale: state.locale,
  }));
  const [draft, setDraft] = useState<HighlightDraft | null>(null);
  const handleStagePointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (activeTool !== "highlight") {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const startX = event.clientX - rect.left;
    const startY = event.clientY - rect.top;
    setDraft({ startX, startY, currentX: startX, currentY: startY });
  };

  const handleStagePointerMove = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (!draft) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const currentX = event.clientX - rect.left;
    const currentY = event.clientY - rect.top;
    setDraft({ ...draft, currentX, currentY });
  };

  const handleStagePointerUp = () => {
    if (!draft) {
      return;
    }
    const x = Math.min(draft.startX, draft.currentX);
    const y = Math.min(draft.startY, draft.currentY);
    const width = Math.abs(draft.currentX - draft.startX);
    const height = Math.abs(draft.currentY - draft.startY);
    if (width > 4 && height > 4) {
      addOverlay({
        id: crypto.randomUUID(),
        type: "highlight",
        pageIndex: 0,
        x,
        y,
        width,
        height,
        style: {
          color: "#fde047",
          opacity: 0.5,
        },
      });
    }
    setDraft(null);
  };

  const handleStageClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool === "select") {
      clearSelected();
      return;
    }

    if (activeTool === "text") {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      addOverlay({
        id: crypto.randomUUID(),
        type: "text",
        pageIndex: 0,
        x,
        y,
        width: 180,
        height: 32,
        content: "",
        style: {
          fontSize: 16,
          color: "#111827",
        },
      });
    }
  };

  const overlaysToRender = useMemo(
    () => overlays.filter((overlay) => overlay.pageIndex === 0),
    [overlays],
  );

  return (
    <div
      className="canvas-layer"
      style={{ width, height }}
      onPointerDown={handleStagePointerDown}
      onPointerMove={handleStagePointerMove}
      onPointerUp={handleStagePointerUp}
      onPointerLeave={handleStagePointerUp}
      onClick={handleStageClick}
    >
      {overlaysToRender.map((overlay) => (
        <OverlayItemView
          key={overlay.id}
          overlay={overlay}
          isSelectable={activeTool === "select"}
          isSelected={selectedId === overlay.id}
          placeholder={t("editor.textPlaceholder")}
          onSelect={setSelectedId}
          onUpdate={updateOverlay}
          onUpdateLive={updateOverlayLive}
          onCommit={commitHistory}
        />
      ))}
      {draft && (
        <div
          className="absolute rounded-md border border-amber-400 bg-amber-300/40"
          style={{
            left: Math.min(draft.startX, draft.currentX),
            top: Math.min(draft.startY, draft.currentY),
            width: Math.abs(draft.currentX - draft.startX),
            height: Math.abs(draft.currentY - draft.startY),
          }}
        />
      )}
    </div>
  );
};

type OverlayItemViewProps = {
  overlay: OverlayObject;
  isSelectable: boolean;
  isSelected: boolean;
  placeholder: string;
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, patch: Partial<OverlayObject>) => void;
  onUpdateLive: (id: string, patch: Partial<OverlayObject>) => void;
  onCommit: () => void;
};

const OverlayItemView = ({
  overlay,
  isSelectable,
  isSelected,
  placeholder,
  onSelect,
  onUpdate,
  onUpdateLive,
  onCommit,
}: OverlayItemViewProps) => {
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isSelectable) {
      return;
    }
    event.stopPropagation();
    onSelect(overlay.id);
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = overlay.x;
    const originY = overlay.y;
    let hasMoved = false;
    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      if (!hasMoved) {
        onCommit();
        hasMoved = true;
      }
      onUpdateLive(overlay.id, {
        x: originX + deltaX,
        y: originY + deltaY,
      });
    };
    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  if (overlay.type === "highlight") {
    return (
      <div
        className={cn(
          "absolute rounded-md border",
          isSelected ? "border-primary" : "border-amber-500/70",
        )}
        style={{
          left: overlay.x,
          top: overlay.y,
          width: overlay.width,
          height: overlay.height,
          backgroundColor: overlay.style?.color ?? "#fde047",
          opacity: overlay.style?.opacity ?? 0.5,
        }}
        onPointerDown={handlePointerDown}
      />
    );
  }

  return (
    <div
      className={cn(
        "absolute rounded-md border bg-white/80 px-2 py-1 shadow-sm focus:outline-none",
        isSelected ? "border-primary" : "border-transparent",
      )}
      style={{
        left: overlay.x,
        top: overlay.y,
        width: overlay.width,
        minHeight: overlay.height,
        color: overlay.style?.color ?? "#111827",
        fontSize: overlay.style?.fontSize ?? 16,
      }}
      onPointerDown={handlePointerDown}
      onClick={(event) => {
        if (isSelectable) {
          event.stopPropagation();
          onSelect(overlay.id);
        }
      }}
      contentEditable
      data-placeholder={placeholder}
      suppressContentEditableWarning
      onBlur={(event) =>
        onUpdate(overlay.id, {
          content: event.currentTarget.textContent ?? "",
        })
      }
    >
      {overlay.content}
    </div>
  );
};
