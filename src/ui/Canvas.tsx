import { RefObject } from "react";
import { OverlayLayer } from "../overlay/OverlayLayer";
import { NativeTextLayer, type NativeTextBlock } from "../overlay/NativeTextLayer";

type CanvasProps = {
  canvasRef: RefObject<HTMLCanvasElement>;
  status: string;
  width: number;
  height: number;
  nativeTextBlocks: NativeTextBlock[];
};

export const Canvas = ({
  canvasRef,
  status,
  width,
  height,
  nativeTextBlocks,
}: CanvasProps) => {
  return (
    <section className="canvas-stage">
      <div className="p-4 text-xs text-muted-foreground">{status}</div>
      <div className="relative mx-auto mb-10" style={{ width, height }}>
        <canvas ref={canvasRef} className="absolute left-0 top-0" />
        {width > 0 && height > 0 && (
          <NativeTextLayer width={width} height={height} blocks={nativeTextBlocks} />
        )}
        {width > 0 && height > 0 && (
          <OverlayLayer width={width} height={height} />
        )}
      </div>
    </section>
  );
};
