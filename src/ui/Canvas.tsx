import { RefObject } from "react";
import { OverlayLayer } from "../overlay/OverlayLayer";

type CanvasProps = {
  canvasRef: RefObject<HTMLCanvasElement>;
  textLayerRef: RefObject<HTMLDivElement>;
  pathLayerRef: RefObject<HTMLDivElement>;
  editingMode: boolean;
  status: string;
  width: number;
  height: number;
};

export const Canvas = ({
  canvasRef,
  textLayerRef,
  pathLayerRef,
  editingMode,
  status,
  width,
  height,
}: CanvasProps) => {
  return (
    <section className="canvas-stage">
      <div className="p-4 text-xs text-muted-foreground">{status}</div>
      <div className="relative mx-auto mb-10" style={{ width, height }}>
        {!editingMode && (
          <canvas ref={canvasRef} className="absolute left-0 top-0 z-0" />
        )}
        {editingMode && (
          <>
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
          </>
        )}
        {!editingMode && width > 0 && height > 0 && (
          <OverlayLayer width={width} height={height} />
        )}
      </div>
    </section>
  );
};
