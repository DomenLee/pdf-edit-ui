import { useMemo, useRef, useState } from "react";
import { OverlayItem } from "./types";
import { useEditorStore } from "../state/editorStore";
import { cn } from "../components/ui/utils";

type OverlayLayerProps = {
  width: number;
  height: number;
};

type DragState =
  | {
      id: string;
      originX: number;
      originY: number;
      startX: number;
      startY: number;
    }
  | undefined;

type HighlightDraft = {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
};

export const OverlayLayer = ({ width, height }: OverlayLayerProps) => {
  const {
    overlays,
    currentTool,
    addOverlay,
    updateOverlay,
    updateOverlayLive,
    commitHistory,
  } = useEditorStore();
  const [draft, setDraft] = useState<HighlightDraft | null>(null);
  const dragRef = useRef<DragState>(undefined);

  const handleStagePointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (currentTool !== "highlight") {
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
        x,
        y,
        width,
        height,
        color: "#fde047",
        opacity: 0.5,
      });
    }
    setDraft(null);
  };

  const handleStageClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (currentTool !== "text") {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    addOverlay({
      id: crypto.randomUUID(),
      type: "text",
      x,
      y,
      width: 180,
      height: 32,
      text: "双击编辑文本",
      fontSize: 16,
      color: "#111827",
    });
  };

  const overlaysToRender = useMemo(() => overlays, [overlays]);

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
          isSelectable={currentTool === "select"}
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
  overlay: OverlayItem;
  isSelectable: boolean;
  onUpdate: (id: string, patch: Partial<OverlayItem>) => void;
  onUpdateLive: (id: string, patch: Partial<OverlayItem>) => void;
  onCommit: () => void;
};

const OverlayItemView = ({
  overlay,
  isSelectable,
  onUpdate,
  onUpdateLive,
  onCommit,
}: OverlayItemViewProps) => {
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isSelectable) {
      return;
    }
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = overlay.x;
    const originY = overlay.y;
    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      onUpdateLive(overlay.id, {
        x: originX + deltaX,
        y: originY + deltaY,
      });
    };
    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      onCommit();
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  if (overlay.type === "highlight") {
    return (
      <div
        className={cn("absolute rounded-md border border-amber-500/70")}
        style={{
          left: overlay.x,
          top: overlay.y,
          width: overlay.width,
          height: overlay.height,
          backgroundColor: overlay.color,
          opacity: overlay.opacity,
        }}
        onPointerDown={handlePointerDown}
      />
    );
  }

  return (
    <div
      className="absolute rounded-md border border-transparent bg-white/80 px-2 py-1 shadow-sm"
      style={{
        left: overlay.x,
        top: overlay.y,
        width: overlay.width,
        minHeight: overlay.height,
        color: overlay.color,
        fontSize: overlay.fontSize,
      }}
      onPointerDown={handlePointerDown}
      contentEditable
      suppressContentEditableWarning
      onBlur={(event) =>
        onUpdate(overlay.id, { text: event.currentTarget.textContent ?? "" })
      }
    >
      {overlay.text}
    </div>
  );
};
