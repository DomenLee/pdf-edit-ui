import { RefObject, useEffect, useState } from "react";
import { cn } from "../components/ui/utils";

type CanvasProps = {
  pageCanvasRef: RefObject<HTMLCanvasElement>;
  textLayerRef: RefObject<HTMLDivElement>;
  status: string;
  width: number;
  height: number;
  zoomPercent: number;
  zoomScale: number;
};

export const Canvas = ({
  pageCanvasRef,
  textLayerRef,
  status,
  width,
  height,
  zoomPercent,
  zoomScale,
}: CanvasProps) => {
  const [showZoom, setShowZoom] = useState(false);

  useEffect(() => {
    setShowZoom(true);
    const timer = window.setTimeout(() => setShowZoom(false), 250);
    return () => window.clearTimeout(timer);
  }, [zoomPercent]);

  return (
    <section className="canvas-stage">
      <div className="pdf-status">{status}</div>
      <div
        className="pdf-page-shell page-root"
        style={{
          width,
          height,
          transform: `scale(${zoomScale})`,
        }}
      >
        <div
          className={cn(
            "pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70 px-4 py-2 text-sm text-foreground/80 shadow-md backdrop-blur transition-all",
            showZoom ? "scale-100 opacity-100" : "scale-95 opacity-0",
          )}
        >
          {zoomPercent}%
        </div>
        <canvas
          ref={pageCanvasRef}
          className="pdf-canvas-layer"
          style={{ width, height }}
        />
        <div
          ref={textLayerRef}
          className="pdf-text-layer"
          style={{ width, height }}
        />
      </div>
    </section>
  );
};
