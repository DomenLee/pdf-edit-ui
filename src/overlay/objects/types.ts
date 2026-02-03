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
