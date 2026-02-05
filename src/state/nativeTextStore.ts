import { create } from "zustand";
import { NativeTextReplacement } from "../overlay/objects/types";

type NativeTextState = {
  activeEditingTextId: string | null;
  nativeTextReplacements: NativeTextReplacement[];
  setActiveEditingTextId: (id: string | null) => void;
  setNativeTextReplacements: (items: NativeTextReplacement[]) => void;
  upsertReplacement: (item: NativeTextReplacement) => void;
};

export const useNativeTextStore = create<NativeTextState>((set) => ({
  activeEditingTextId: null,
  nativeTextReplacements: [],
  setActiveEditingTextId: (id) => set({ activeEditingTextId: id }),
  setNativeTextReplacements: (items) => set({ nativeTextReplacements: items }),
  upsertReplacement: (item) =>
    set((state) => {
      const existingIndex = state.nativeTextReplacements.findIndex(
        (entry) => entry.id === item.id,
      );
      if (existingIndex === -1) {
        return { nativeTextReplacements: [...state.nativeTextReplacements, item] };
      }
      const next = [...state.nativeTextReplacements];
      next[existingIndex] = item;
      return { nativeTextReplacements: next };
    }),
}));
