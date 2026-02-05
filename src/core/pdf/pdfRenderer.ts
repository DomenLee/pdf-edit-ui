import {
  getDocument,
  GlobalWorkerOptions,
  renderTextLayer,
  OPS,
  type PDFPageProxy,
} from "pdfjs-dist";

GlobalWorkerOptions.workerSrc = "/pdf.worker.js";
const baseUrl = import.meta.env.BASE_URL ?? "/";
const cMapUrl = `${baseUrl}cmaps/`;
const standardFontDataUrl = `${baseUrl}standard_fonts/`;

export const loadPdfPage = async (data: ArrayBuffer, pageNumber = 1) => {
  const loadingTask = getDocument({
    data,
    cMapUrl,
    cMapPacked: true,
    standardFontDataUrl,
    enableXfa: true,
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(pageNumber);
  return page;
};

const normalizeRotation = (rotation: number) => {
  const normalized = ((rotation % 360) + 360) % 360;
  return normalized;
};

export const getPageViewport = (page: PDFPageProxy, scale: number) => {
  const rotation = normalizeRotation(page.rotate ?? 0);
  return page.getViewport({ scale, rotation });
};

export const renderPage = async (
  page: PDFPageProxy,
  canvas: HTMLCanvasElement,
  scale = 1.2,
) => {
  const viewport = getPageViewport(page, scale);
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("无法获取 2D Context");
  }

  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: context, viewport }).promise;
  return { width: viewport.width, height: viewport.height, scale };
};

export const renderTextLayerForPage = async (
  page: PDFPageProxy,
  container: HTMLDivElement,
  scale = 1.2,
) => {
  const viewport = getPageViewport(page, scale);
  container.innerHTML = "";
  container.style.setProperty("--scale-factor", `${viewport.scale}`);
  container.style.width = `${viewport.width}px`;
  container.style.height = `${viewport.height}px`;
  const textContent = await (page as any).getTextContent();
  const textDivs: HTMLElement[] = [];
  const task = renderTextLayer({
    textContentSource: textContent,
    container,
    viewport,
    textDivs,
    enhanceTextSelection: false,
  });
  if (task?.promise) {
    await task.promise;
  }
};

export const renderPathLayerForPage = async (
  page: PDFPageProxy,
  container: HTMLDivElement,
  scale = 1.2,
) => {
  const viewport = getPageViewport(page, scale);
  container.innerHTML = "";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", `${viewport.width}`);
  svg.setAttribute("height", `${viewport.height}`);
  svg.setAttribute("viewBox", `0 0 ${viewport.width} ${viewport.height}`);
  svg.style.position = "absolute";
  svg.style.left = "0";
  svg.style.top = "0";

  const opList = await (page as any).getOperatorList();
  const fnArray = opList?.fnArray ?? [];
  const argsArray = opList?.argsArray ?? [];

  let path = "";
  let strokeColor = "rgba(17,24,39,0.4)";
  let fillColor = "rgba(17,24,39,0.15)";
  let lineWidth = 1;

  const flushPath = (mode: "stroke" | "fill") => {
    if (!path) {
      return;
    }
    const pathEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
    pathEl.setAttribute("d", path);
    if (mode === "stroke") {
      pathEl.setAttribute("fill", "none");
      pathEl.setAttribute("stroke", strokeColor);
      pathEl.setAttribute("stroke-width", `${lineWidth}`);
    } else {
      pathEl.setAttribute("fill", fillColor);
      pathEl.setAttribute("stroke", "none");
    }
    svg.appendChild(pathEl);
    path = "";
  };

  const toViewportPoint = (x: number, y: number) => {
    const point = viewport.convertToViewportPoint?.(x, y);
    return point ? { x: point[0], y: point[1] } : { x, y };
  };

  for (let i = 0; i < fnArray.length; i += 1) {
    const fn = fnArray[i];
    const args = argsArray[i] ?? [];
    switch (fn) {
      case OPS.setStrokeRGBColor: {
        const [r, g, b] = args;
        strokeColor = `rgba(${Math.round(r * 255)}, ${Math.round(
          g * 255,
        )}, ${Math.round(b * 255)}, 0.5)`;
        break;
      }
      case OPS.setFillRGBColor: {
        const [r, g, b] = args;
        fillColor = `rgba(${Math.round(r * 255)}, ${Math.round(
          g * 255,
        )}, ${Math.round(b * 255)}, 0.2)`;
        break;
      }
      case OPS.setLineWidth: {
        lineWidth = args[0] ?? 1;
        break;
      }
      case OPS.moveTo: {
        const [x, y] = args;
        const p = toViewportPoint(x, y);
        path += `M ${p.x} ${p.y} `;
        break;
      }
      case OPS.lineTo: {
        const [x, y] = args;
        const p = toViewportPoint(x, y);
        path += `L ${p.x} ${p.y} `;
        break;
      }
      case OPS.curveTo: {
        const [x1, y1, x2, y2, x3, y3] = args;
        const p1 = toViewportPoint(x1, y1);
        const p2 = toViewportPoint(x2, y2);
        const p3 = toViewportPoint(x3, y3);
        path += `C ${p1.x} ${p1.y} ${p2.x} ${p2.y} ${p3.x} ${p3.y} `;
        break;
      }
      case OPS.curveTo2: {
        const [x2, y2, x3, y3] = args;
        const p2 = toViewportPoint(x2, y2);
        const p3 = toViewportPoint(x3, y3);
        path += `Q ${p2.x} ${p2.y} ${p3.x} ${p3.y} `;
        break;
      }
      case OPS.curveTo3: {
        const [x1, y1, x3, y3] = args;
        const p1 = toViewportPoint(x1, y1);
        const p3 = toViewportPoint(x3, y3);
        path += `Q ${p1.x} ${p1.y} ${p3.x} ${p3.y} `;
        break;
      }
      case OPS.rectangle: {
        const [x, y, w, h] = args;
        const p1 = toViewportPoint(x, y);
        const p2 = toViewportPoint(x + w, y + h);
        const rx = Math.min(p1.x, p2.x);
        const ry = Math.min(p1.y, p2.y);
        const rw = Math.abs(p2.x - p1.x);
        const rh = Math.abs(p2.y - p1.y);
        path += `M ${rx} ${ry} h ${rw} v ${rh} h ${-rw} Z `;
        break;
      }
      case OPS.closePath:
        path += "Z ";
        break;
      case OPS.stroke:
      case OPS.closeStroke:
        flushPath("stroke");
        break;
      case OPS.fill:
      case OPS.eoFill:
      case OPS.fillStroke:
      case OPS.eoFillStroke:
      case OPS.closeFillStroke:
      case OPS.closeEOFillStroke:
        flushPath("fill");
        break;
      default:
        break;
    }
  }

  container.appendChild(svg);
};

export const renderFirstPage = async (
  data: ArrayBuffer,
  canvas: HTMLCanvasElement,
) => {
  const page = await loadPdfPage(data, 1);
  return renderPage(page, canvas);
};
