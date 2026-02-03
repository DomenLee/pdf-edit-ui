import { create } from "zustand";
import { OverlayObject } from "../overlay/objects/types";

type HistoryState = {
  past: OverlayObject[][];
  future: OverlayObject[][];
  reset: () => void;
  snapshot: (overlays: OverlayObject[]) => void;
  undo: (current: OverlayObject[]) => OverlayObject[] | null;
  redo: (current: OverlayObject[]) => OverlayObject[] | null;
};

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],
  reset: () => set({ past: [], future: [] }),
  snapshot: (overlays) =>
    set((state) => ({
      past: [...state.past, overlays],
      future: [],
    })),
  undo: (current) => {
    const { past, future } = get();
    if (past.length === 0) {
      return null;
    }
    const previous = past[past.length - 1];
    set({
      past: past.slice(0, -1),
      future: [current, ...future],
    });
    return previous;
  },
  redo: (current) => {
    const { past, future } = get();
    if (future.length === 0) {
      return null;
    }
    const next = future[0];
    set({
      past: [...past, current],
      future: future.slice(1),
    });
    return next;
  },
}));
