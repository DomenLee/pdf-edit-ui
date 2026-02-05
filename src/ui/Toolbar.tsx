import {
  Download,
  Highlighter,
  MousePointer2,
  Redo2,
  Type,
  Undo2,
  Languages,
  ZoomIn,
  ZoomOut,
  PencilLine,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Toggle } from "../components/ui/toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { useToolStore } from "../state/toolStore";
import { useOverlayStore } from "../state/overlayStore";
import { useHistoryStore } from "../state/historyStore";
import { useI18nStore } from "../i18n/i18nStore";
import { OverlayTool } from "../overlay/tools/toolTypes";

type ToolbarProps = {
  onExport: () => void;
};

export const Toolbar = ({ onExport }: ToolbarProps) => {
  const activeTool = useToolStore((state) => state.activeTool);
  const setTool = useToolStore((state) => state.setTool);
  const undo = useOverlayStore((state) => state.undo);
  const redo = useOverlayStore((state) => state.redo);
  const pastCount = useHistoryStore((state) => state.past.length);
  const futureCount = useHistoryStore((state) => state.future.length);
  const locale = useI18nStore((state) => state.locale);
  const setLocale = useI18nStore((state) => state.setLocale);
  const t = useI18nStore((state) => state.t);

  const handleToggle = (tool: OverlayTool) => {
    setTool(tool);
  };

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-2 rounded-2xl bg-white/70 px-4 py-2 shadow-md backdrop-blur">
        <Toggle
          pressed={activeTool === "select"}
          onPressedChange={() => handleToggle("select")}
          variant="outline"
          className="h-9 w-9 justify-center rounded-xl border-0 bg-transparent text-foreground/80 hover:bg-white/60 data-[state=on]:bg-white/80"
        >
          <MousePointer2 className="h-4 w-4" />
          <span className="sr-only">{t("toolbar.select")}</span>
        </Toggle>
        <Toggle
          pressed={activeTool === "text"}
          onPressedChange={() => handleToggle("text")}
          variant="outline"
          className="h-9 w-9 justify-center rounded-xl border-0 bg-transparent text-foreground/80 hover:bg-white/60 data-[state=on]:bg-white/80"
        >
          <Type className="h-4 w-4" />
          <span className="sr-only">{t("toolbar.text")}</span>
        </Toggle>
        <Toggle
          pressed={activeTool === "highlight"}
          onPressedChange={() => handleToggle("highlight")}
          variant="outline"
          className="h-9 w-9 justify-center rounded-xl border-0 bg-transparent text-foreground/80 hover:bg-white/60 data-[state=on]:bg-white/80"
        >
          <Highlighter className="h-4 w-4" />
          <span className="sr-only">{t("toolbar.highlight")}</span>
        </Toggle>
        <div className="mx-1 h-5 w-px bg-foreground/10" />
        <Button
          variant="ghost"
          size="icon"
          onClick={undo}
          disabled={pastCount === 0}
          className="h-9 w-9 rounded-xl text-foreground/80 hover:bg-white/60"
        >
          <Undo2 className="h-4 w-4" />
          <span className="sr-only">{t("toolbar.undo")}</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={redo}
          disabled={futureCount === 0}
          className="h-9 w-9 rounded-xl text-foreground/80 hover:bg-white/60"
        >
          <Redo2 className="h-4 w-4" />
          <span className="sr-only">{t("toolbar.redo")}</span>
        </Button>
        <Toggle
          pressed
          variant="outline"
          className="hidden h-9 w-9 justify-center rounded-xl border-0 bg-white/70 text-foreground/80 sm:flex"
        >
          <PencilLine className="h-4 w-4" />
          <span className="sr-only">{t("toolbar.text")}</span>
        </Toggle>
        <div className="hidden items-center gap-2 rounded-xl bg-white/60 px-2 py-1 text-xs text-foreground/70 sm:flex">
          100%
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="hidden h-9 w-9 rounded-xl text-foreground/80 hover:bg-white/60 sm:flex"
        >
          <ZoomOut className="h-4 w-4" />
          <span className="sr-only">Zoom out</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="hidden h-9 w-9 rounded-xl text-foreground/80 hover:bg-white/60 sm:flex"
        >
          <ZoomIn className="h-4 w-4" />
          <span className="sr-only">Zoom in</span>
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={onExport}
          className="h-9 w-9 rounded-xl text-foreground/80 hover:bg-white/60"
        >
          <Download className="h-4 w-4" />
          <span className="sr-only">{t("toolbar.export")}</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-foreground/80 hover:bg-white/60">
              <Languages className="h-4 w-4" />
              <span className="sr-only">{t("toolbar.language")}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => setLocale("zh-CN")}
              className={locale === "zh-CN" ? "font-semibold" : undefined}
            >
              {t("common.zhCN")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setLocale("en-US")}
              className={locale === "en-US" ? "font-semibold" : undefined}
            >
              {t("common.enUS")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
