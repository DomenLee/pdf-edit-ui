import {
  Download,
  Highlighter,
  MousePointer2,
  Redo2,
  Type,
  Undo2,
  Languages,
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
    <div className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
      <div className="flex items-center gap-2">
        <Toggle
          pressed={activeTool === "select"}
          onPressedChange={() => handleToggle("select")}
          variant="outline"
        >
          <MousePointer2 className="h-4 w-4" />
          {t("toolbar.select")}
        </Toggle>
        <Toggle
          pressed={activeTool === "text"}
          onPressedChange={() => handleToggle("text")}
          variant="outline"
        >
          <Type className="h-4 w-4" />
          {t("toolbar.text")}
        </Toggle>
        <Toggle
          pressed={activeTool === "highlight"}
          onPressedChange={() => handleToggle("highlight")}
          variant="outline"
        >
          <Highlighter className="h-4 w-4" />
          {t("toolbar.highlight")}
        </Toggle>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={undo}
          disabled={pastCount === 0}
        >
          <Undo2 className="h-4 w-4" />
          {t("toolbar.undo")}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={redo}
          disabled={futureCount === 0}
        >
          <Redo2 className="h-4 w-4" />
          {t("toolbar.redo")}
        </Button>
        <Button size="sm" onClick={onExport}>
          <Download className="h-4 w-4" />
          {t("toolbar.export")}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Languages className="h-4 w-4" />
              {t("toolbar.language")}
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
