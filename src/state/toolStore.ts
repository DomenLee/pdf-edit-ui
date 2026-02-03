import { create } from "zustand";
import { OverlayTool } from "../overlay/tools/toolTypes";

type ToolState = {
  activeTool: OverlayTool;
  setTool: (tool: OverlayTool) => void;
};

export const useToolStore = create<ToolState>((set) => ({
  activeTool: "select",
  setTool: (tool) => set({ activeTool: tool }),
}));
