import { RefObject, useEffect, useState } from "react";
import { OverlayLayer } from "../overlay/OverlayLayer";
import { cn } from "../components/ui/utils";

type CanvasProps = {
  canvasRef: RefObject<HTMLCanvasElement>;
  textLayerRef: RefObject<HTMLDivElement>;
  pathLayerRef: RefObject<HTMLDivElement>;
  status: string;
  width: number;
  height: number;
  zoomPercent: number;
};

export const Canvas = ({
  canvasRef,
  textLayerRef,
  pathLayerRef,
  status,
  width,
  height,
  zoomPercent,
}: CanvasProps) => {
  const [showZoom, setShowZoom] = useState(false);

  useEffect(() => {
    setShowZoom(true);
    const timer = window.setTimeout(() => setShowZoom(false), 250);
    return () => window.clearTimeout(timer);
  }, [zoomPercent]);

  return (
    <section className="canvas-stage">
      <div className="p-4 text-xs text-muted-foreground">{status}</div>
      <div className="relative mx-auto mb-10" style={{ width, height }}>
        <div
          className={cn(
            "pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70 px-4 py-2 text-sm text-foreground/80 shadow-md backdrop-blur transition-all",
            showZoom ? "scale-100 opacity-100" : "scale-95 opacity-0",
          )}
        >
          {zoomPercent}%
        </div>
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
