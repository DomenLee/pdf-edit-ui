import { create } from "zustand";
import { EditedTextItem } from "../overlay/objects/types";

type TextLayerState = {
  activeEditingTextId: string | null;
  editedTextItems: EditedTextItem[];
  setActiveEditingTextId: (id: string | null) => void;
  setEditedTextItems: (items: EditedTextItem[]) => void;
  upsertEditedTextItem: (item: EditedTextItem) => void;
};

export const useTextLayerStore = create<TextLayerState>((set) => ({
  activeEditingTextId: null,
  editedTextItems: [],
  setActiveEditingTextId: (id) => set({ activeEditingTextId: id }),
  setEditedTextItems: (items) => set({ editedTextItems: items }),
  upsertEditedTextItem: (item) =>
    set((state) => {
      const existingIndex = state.editedTextItems.findIndex(
        (entry) => entry.id === item.id,
      );
      if (existingIndex === -1) {
        return { editedTextItems: [...state.editedTextItems, item] };
      }
      const next = [...state.editedTextItems];
      next[existingIndex] = item;
      return { editedTextItems: next };
    }),
}));
