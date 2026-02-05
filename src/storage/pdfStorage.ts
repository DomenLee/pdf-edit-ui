import { openDB } from "idb";
import { NativeTextReplacement, OverlayObject } from "../overlay/objects/types";

const DB_NAME = "pdf-editor-db";
const STORE_NAME = "pdfs";
const OVERLAY_STORE = "overlays";

export type StoredPdf = {
  id: string;
  name: string;
  data: ArrayBuffer;
  createdAt: number;
};

const dbPromise = openDB(DB_NAME, 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME, { keyPath: "id" });
    }
    if (!db.objectStoreNames.contains(OVERLAY_STORE)) {
      db.createObjectStore(OVERLAY_STORE, { keyPath: "id" });
    }
  },
});

export const savePdf = async (file: File) => {
  const data = await file.arrayBuffer();
  const entry: StoredPdf = {
    id: crypto.randomUUID(),
    name: file.name,
    data,
    createdAt: Date.now(),
  };

  const db = await dbPromise;
  await db.put(STORE_NAME, entry);
  return entry.id;
};

export const getPdfById = async (id: string) => {
  const db = await dbPromise;
  return db.get(STORE_NAME, id) as Promise<StoredPdf | undefined>;
};

export type StoredOverlays = {
  id: string;
  overlays: OverlayObject[];
  nativeTextReplacements?: NativeTextReplacement[];
  updatedAt: number;
};

export const saveOverlays = async (
  id: string,
  overlays: OverlayObject[],
  nativeTextReplacements: NativeTextReplacement[] = [],
) => {
  const db = await dbPromise;
  const entry: StoredOverlays = {
    id,
    overlays,
    nativeTextReplacements,
    updatedAt: Date.now(),
  };
  await db.put(OVERLAY_STORE, entry);
};

export const getOverlays = async (id: string) => {
  const db = await dbPromise;
  return db.get(OVERLAY_STORE, id) as Promise<StoredOverlays | undefined>;
};
