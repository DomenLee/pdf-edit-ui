import { create } from "zustand";
import { OverlayItem, OverlayTool } from "../overlay/types";

type HistoryState = {
  past: OverlayItem[][];
  future: OverlayItem[][];
};

type EditorState = {
  currentId: string | null;
  currentTool: OverlayTool;
  overlays: OverlayItem[];
  history: HistoryState;
  setCurrentId: (id: string | null) => void;
  setTool: (tool: OverlayTool) => void;
  setOverlays: (overlays: OverlayItem[]) => void;
  initializeOverlays: (overlays: OverlayItem[]) => void;
  addOverlay: (overlay: OverlayItem) => void;
  updateOverlay: (id: string, patch: Partial<OverlayItem>) => void;
  updateOverlayLive: (id: string, patch: Partial<OverlayItem>) => void;
  replaceOverlay: (overlay: OverlayItem) => void;
  deleteOverlay: (id: string) => void;
  commitHistory: () => void;
  undo: () => void;
  redo: () => void;
};

const pushHistory = (overlays: OverlayItem[], history: HistoryState) => ({
  past: [...history.past, overlays],
  future: [],
});

export const useEditorStore = create<EditorState>((set, get) => ({
  currentId: null,
  currentTool: "select",
  overlays: [],
  history: { past: [], future: [] },
  setCurrentId: (id) => set({ currentId: id }),
  setTool: (tool) => set({ currentTool: tool }),
  setOverlays: (overlays) =>
    set((state) => ({
      overlays,
      history: pushHistory(state.overlays, state.history),
    })),
  initializeOverlays: (overlays) =>
    set({
      overlays,
      history: { past: [], future: [] },
    }),
  addOverlay: (overlay) =>
    set((state) => ({
      overlays: [...state.overlays, overlay],
      history: pushHistory(state.overlays, state.history),
    })),
  updateOverlay: (id, patch) =>
    set((state) => ({
      overlays: state.overlays.map((item) =>
        item.id === id ? ({ ...item, ...patch } as OverlayItem) : item,
      ),
      history: pushHistory(state.overlays, state.history),
    })),
  updateOverlayLive: (id, patch) =>
    set((state) => ({
      overlays: state.overlays.map((item) =>
        item.id === id ? ({ ...item, ...patch } as OverlayItem) : item,
      ),
    })),
  replaceOverlay: (overlay) =>
    set((state) => ({
      overlays: state.overlays.map((item) =>
        item.id === overlay.id ? overlay : item,
      ),
      history: pushHistory(state.overlays, state.history),
    })),
  deleteOverlay: (id) =>
    set((state) => ({
      overlays: state.overlays.filter((item) => item.id !== id),
      history: pushHistory(state.overlays, state.history),
    })),
  commitHistory: () =>
    set((state) => ({
      history: pushHistory(state.overlays, state.history),
    })),
  undo: () => {
    const { history, overlays } = get();
    if (history.past.length === 0) {
      return;
    }
    const previous = history.past[history.past.length - 1];
    set({
      overlays: previous,
      history: {
        past: history.past.slice(0, -1),
        future: [overlays, ...history.future],
      },
    });
  },
  redo: () => {
    const { history, overlays } = get();
    if (history.future.length === 0) {
      return;
    }
    const next = history.future[0];
    set({
      overlays: next,
      history: {
        past: [...history.past, overlays],
        future: history.future.slice(1),
      },
    });
  },
}));
