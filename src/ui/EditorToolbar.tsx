import { Undo2, Redo2, Type, Highlighter, MousePointer2, Download } from "lucide-react";
import { Button } from "../components/ui/button";
import { Toggle } from "../components/ui/toggle";
import { OverlayTool } from "../overlay/types";
import { useEditorStore } from "../state/editorStore";

type EditorToolbarProps = {
  onExport: () => void;
};

export const EditorToolbar = ({ onExport }: EditorToolbarProps) => {
  const { currentTool, setTool, undo, redo } = useEditorStore();

  const handleToggle = (tool: OverlayTool) => {
    setTool(tool);
  };

  return (
    <div className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
      <div className="flex items-center gap-2">
        <Toggle
          pressed={currentTool === "select"}
          onPressedChange={() => handleToggle("select")}
          variant="outline"
        >
          <MousePointer2 className="h-4 w-4" />
          Select
        </Toggle>
        <Toggle
          pressed={currentTool === "text"}
          onPressedChange={() => handleToggle("text")}
          variant="outline"
        >
          <Type className="h-4 w-4" />
          Text
        </Toggle>
        <Toggle
          pressed={currentTool === "highlight"}
          onPressedChange={() => handleToggle("highlight")}
          variant="outline"
        >
          <Highlighter className="h-4 w-4" />
          Highlight
        </Toggle>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={undo}>
          <Undo2 className="h-4 w-4" />
          Undo
        </Button>
        <Button variant="secondary" size="sm" onClick={redo}>
          <Redo2 className="h-4 w-4" />
          Redo
        </Button>
        <Button size="sm" onClick={onExport}>
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>
    </div>
  );
};
