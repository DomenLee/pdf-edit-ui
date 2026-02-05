import { RefObject } from "react";
import { OverlayLayer } from "../overlay/OverlayLayer";

type CanvasProps = {
  canvasRef: RefObject<HTMLCanvasElement>;
  textLayerRef: RefObject<HTMLDivElement>;
  pathLayerRef: RefObject<HTMLDivElement>;
  status: string;
  width: number;
  height: number;
};

export const Canvas = ({
  canvasRef,
  textLayerRef,
  pathLayerRef,
  status,
  width,
  height,
}: CanvasProps) => {
  return (
    <section className="canvas-stage">
      <div className="p-4 text-xs text-muted-foreground">{status}</div>
      <div className="relative mx-auto mb-10" style={{ width, height }}>
        <div
          ref={pathLayerRef}
          className="pdf-path-layer"
          style={{ width, height }}
        />
        <div
          ref={textLayerRef}
          className="pdf-text-layer"
          style={{ width, height }}
        />
        {width > 0 && height > 0 && <OverlayLayer width={width} height={height} />}
      </div>
    </section>
  );
};
