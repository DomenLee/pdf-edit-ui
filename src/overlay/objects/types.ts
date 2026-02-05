export type OverlayType = "text" | "highlight";

export type OverlayStyle = {
  color?: string;
  fontSize?: number;
  opacity?: number;
};

export type OverlayObject = {
  id: string;
  type: OverlayType;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  content?: string;
  style?: OverlayStyle;
};

export type NativeTextReplacement = {
  id: string;
  type: "native-text-replacement";
  pageIndex: number;
  originalText: string;
  replacementText: string;
  originalBBox: { x: number; y: number; width: number; height: number };
  fontSize: number;
};
