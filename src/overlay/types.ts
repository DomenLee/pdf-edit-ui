export type OverlayTool = "select" | "text" | "highlight";

export type BaseOverlay = {
  id: string;
  type: "text" | "highlight";
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TextOverlay = BaseOverlay & {
  type: "text";
  text: string;
  fontSize: number;
  color: string;
};

export type HighlightOverlay = BaseOverlay & {
  type: "highlight";
  color: string;
  opacity: number;
};

export type OverlayItem = TextOverlay | HighlightOverlay;
