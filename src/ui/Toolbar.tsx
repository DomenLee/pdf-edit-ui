import {
  Download,
  Redo2,
  Undo2,
  ZoomIn,
  ZoomOut,
  PencilLine,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { useOverlayStore } from "../state/overlayStore";
import { useHistoryStore } from "../state/historyStore";
import { useI18nStore } from "../i18n/i18nStore";

type ToolbarProps = {
  zoomPercent: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onExport: () => void;
};

export const Toolbar = ({
  zoomPercent,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onExport,
}: ToolbarProps) => {
  const undo = useOverlayStore((state) => state.undo);
  const redo = useOverlayStore((state) => state.redo);
  const pastCount = useHistoryStore((state) => state.past.length);
  const futureCount = useHistoryStore((state) => state.future.length);
  const t = useI18nStore((state) => state.t);

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-4 rounded-2xl bg-white/70 px-4 py-2 shadow-md backdrop-blur">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={undo}
            disabled={pastCount === 0}
            className="h-9 w-9 rounded-xl border-0 bg-transparent text-foreground/80 hover:bg-white/60"
          >
            <Undo2 className="h-4 w-4" />
            <span className="sr-only">{t("toolbar.undo")}</span>
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={redo}
            disabled={futureCount === 0}
            className="h-9 w-9 rounded-xl border-0 bg-transparent text-foreground/80 hover:bg-white/60"
          >
            <Redo2 className="h-4 w-4" />
            <span className="sr-only">{t("toolbar.redo")}</span>
          </Button>
        </div>

        <div className="flex items-center">
          <Button
            variant="outline"
            size="icon"
            onClick={() => console.info("Edit mode active")}
            className="h-9 w-9 rounded-xl border-0 bg-white/70 text-foreground/80 opacity-100"
          >
            <PencilLine className="h-4 w-4" />
            <span className="sr-only">editing</span>
          </Button>
        </div>

        <div className="flex items-center gap-1 rounded-xl bg-white/60 px-1.5 py-1">
          <Button
            variant="outline"
            size="icon"
            onClick={onZoomOut}
            className="h-8 w-8 rounded-lg border-0 bg-transparent text-foreground/80 hover:bg-white/60"
          >
            <ZoomOut className="h-4 w-4" />
            <span className="sr-only">Zoom out</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onZoomReset}
            className="h-8 min-w-14 rounded-lg border-0 bg-transparent px-2 text-xs font-medium text-foreground/75 hover:bg-white/60"
          >
            {zoomPercent}%
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={onZoomIn}
            className="h-8 w-8 rounded-lg border-0 bg-transparent text-foreground/80 hover:bg-white/60"
          >
            <ZoomIn className="h-4 w-4" />
            <span className="sr-only">Zoom in</span>
          </Button>
        </div>

        <div className="ml-2 flex items-center">
          <Button
            size="icon"
            variant="outline"
            onClick={onExport}
            className="h-9 w-9 rounded-xl border-0 bg-transparent text-foreground/80 hover:bg-white/60"
          >
            <Download className="h-4 w-4" />
            <span className="sr-only">{t("toolbar.export")}</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
