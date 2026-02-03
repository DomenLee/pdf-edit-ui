import { create } from "zustand";
import { OverlayObject } from "../overlay/objects/types";
import { useHistoryStore } from "./historyStore";

type OverlayState = {
  documentId: string | null;
  overlays: OverlayObject[];
  selectedId: string | null;
  setDocumentId: (id: string | null) => void;
  initializeOverlays: (overlays: OverlayObject[]) => void;
  setOverlays: (overlays: OverlayObject[]) => void;
  setSelectedId: (id: string | null) => void;
  clearSelected: () => void;
  commitHistory: () => void;
  addOverlay: (overlay: OverlayObject) => void;
  updateOverlay: (id: string, patch: Partial<OverlayObject>) => void;
  updateOverlayLive: (id: string, patch: Partial<OverlayObject>) => void;
  deleteOverlay: (id: string) => void;
  undo: () => void;
  redo: () => void;
};

export const useOverlayStore = create<OverlayState>((set, get) => ({
  documentId: null,
  overlays: [],
  selectedId: null,
  setDocumentId: (id) => set({ documentId: id }),
  initializeOverlays: (overlays) => {
    useHistoryStore.getState().reset();
    set({ overlays, selectedId: null });
  },
  setOverlays: (overlays) => set({ overlays }),
  setSelectedId: (id) => set({ selectedId: id }),
  clearSelected: () => set({ selectedId: null }),
  commitHistory: () => {
    const overlays = get().overlays;
    useHistoryStore.getState().snapshot(overlays);
  },
  addOverlay: (overlay) => {
    useHistoryStore.getState().snapshot(get().overlays);
    set((state) => ({
      overlays: [...state.overlays, overlay],
      selectedId: overlay.id,
    }));
  },
  updateOverlay: (id, patch) => {
    useHistoryStore.getState().snapshot(get().overlays);
    set((state) => ({
      overlays: state.overlays.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    }));
  },
  updateOverlayLive: (id, patch) =>
    set((state) => ({
      overlays: state.overlays.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    })),
  deleteOverlay: (id) => {
    useHistoryStore.getState().snapshot(get().overlays);
    set((state) => ({
      overlays: state.overlays.filter((item) => item.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
    }));
  },
  undo: () => {
    const current = get().overlays;
    const previous = useHistoryStore.getState().undo(current);
    if (previous) {
      set({ overlays: previous, selectedId: null });
    }
  },
  redo: () => {
    const current = get().overlays;
    const next = useHistoryStore.getState().redo(current);
    if (next) {
      set({ overlays: next, selectedId: null });
    }
  },
}));
