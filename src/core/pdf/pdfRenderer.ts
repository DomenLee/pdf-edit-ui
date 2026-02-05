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

type Matrix = [number, number, number, number, number, number];
type RgbColor = { r: number; g: number; b: number };
type GraphicsState = {
  strokeColor: RgbColor;
  fillColor: RgbColor;
  lineWidth: number;
  ctm: Matrix;
};

const IDENTITY_MATRIX: Matrix = [1, 0, 0, 1, 0, 0];
const DEFAULT_STROKE: RgbColor = { r: 0, g: 0, b: 0 };
const DEFAULT_FILL: RgbColor = { r: 0, g: 0, b: 0 };

const clamp = (value: number) => Math.max(0, Math.min(1, value));

const multiplyMatrix = (m1: Matrix, m2: Matrix): Matrix => [
  m1[0] * m2[0] + m1[2] * m2[1],
  m1[1] * m2[0] + m1[3] * m2[1],
  m1[0] * m2[2] + m1[2] * m2[3],
  m1[1] * m2[2] + m1[3] * m2[3],
  m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
  m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
];

const applyMatrix = (m: Matrix, x: number, y: number) => ({
  x: m[0] * x + m[2] * y + m[4],
  y: m[1] * x + m[3] * y + m[5],
});

const matrixScale = (m: Matrix) => Math.sqrt(Math.max(1e-6, Math.abs(m[0] * m[3] - m[1] * m[2])));

const rgbCss = ({ r, g, b }: RgbColor) =>
  `rgb(${Math.round(clamp(r) * 255)},${Math.round(clamp(g) * 255)},${Math.round(clamp(b) * 255)})`;

const cmykToRgb = (c: number, m: number, y: number, k: number): RgbColor => ({
  r: clamp(1 - Math.min(1, c + k)),
  g: clamp(1 - Math.min(1, m + k)),
  b: clamp(1 - Math.min(1, y + k)),
});

const normalizeRotation = (rotation: number) => {
  const normalized = ((rotation % 360) + 360) % 360;
  return normalized;
};

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

  const originalFillText = context.fillText.bind(context);
  const originalStrokeText = context.strokeText.bind(context);

  context.fillText = (() => {
    return;
  }) as CanvasRenderingContext2D["fillText"];
  context.strokeText = (() => {
    return;
  }) as CanvasRenderingContext2D["strokeText"];

  try {
    const renderTask = (page as any).render({
      canvasContext: context,
      viewport,
      renderTextLayer: false,
      renderAnnotationLayer: false,
      annotationMode: 0,
    });
    await renderTask.promise;
  } finally {
    context.fillText = originalFillText;
    context.strokeText = originalStrokeText;
  }

  return { width: viewport.width, height: viewport.height, scale };
};


export const renderPageForColorSampling = async (
  page: PDFPageProxy,
  scale = 1.2,
) => {
  const viewport = getPageViewport(page, scale);
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("无法获取采样 Canvas Context");
  }

  await (page as any).render({
    canvasContext: context,
    viewport,
    renderTextLayer: false,
    renderAnnotationLayer: false,
    annotationMode: 0,
  }).promise;

  return { canvas, context, viewport };
};

export const renderTextLayerForPage = async (
  page: PDFPageProxy,
  container: HTMLDivElement,
  scale = 1.2,
  colorSourceContext?: CanvasRenderingContext2D,
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

  const COVER_SCALE = 1.01;
  const containerRect = container.getBoundingClientRect();

  textDivs.forEach((textDiv) => {
    const currentSize = Number.parseFloat(textDiv.style.fontSize || "0");
    if (Number.isFinite(currentSize) && currentSize > 0) {
      textDiv.style.fontSize = `${currentSize * COVER_SCALE}px`;
    }

    textDiv.style.lineHeight = "1";
    textDiv.style.whiteSpace = "pre";
    textDiv.style.background = "none";
    textDiv.style.textShadow = "0 0 0 #fff, 0 0 1px #fff, 0 0 2px #fff";
    textDiv.style.outline = "none";

    if (!colorSourceContext) {
      return;
    }

    const rect = textDiv.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }

    const sampleX = Math.floor(Math.max(0, Math.min(colorSourceContext.canvas.width - 1, rect.left - containerRect.left + rect.width / 2)));
    const sampleY = Math.floor(Math.max(0, Math.min(colorSourceContext.canvas.height - 1, rect.top - containerRect.top + rect.height / 2)));

    try {
      const { data } = colorSourceContext.getImageData(sampleX, sampleY, 1, 1);
      textDiv.style.color = `rgb(${data[0]}, ${data[1]}, ${data[2]})`;
      textDiv.style.caretColor = `rgb(${data[0]}, ${data[1]}, ${data[2]})`;
    } catch (error) {
      // ignore sampling failures, keep default text color
    }
  });
};

const normalizeAnnotationSubtype = (annotation: Record<string, any>) =>
  String(annotation.subtype ?? annotation.fieldType ?? "").toLowerCase();

const isStampLikeAnnotation = (annotation: Record<string, any>) => {
  const subtype = normalizeAnnotationSubtype(annotation);
  const fieldName = String(annotation.fieldName ?? "").toLowerCase();
  return subtype === "stamp" || subtype === "signature" || fieldName.includes("sign");
};

const annotationBitmapToDataUrl = (annotation: Record<string, any>) => {
  const bitmap = annotation.bitmap ?? annotation.imageData;
  if (!bitmap) {
    return null;
  }
  const width = Number(bitmap.width ?? 0);
  const height = Number(bitmap.height ?? 0);
  const raw = bitmap.data;
  if (!width || !height || !raw) {
    return null;
  }

  const imageCanvas = document.createElement("canvas");
  imageCanvas.width = width;
  imageCanvas.height = height;
  const ctx = imageCanvas.getContext("2d");
  if (!ctx) {
    return null;
  }

  const buffer = raw instanceof Uint8ClampedArray ? raw : new Uint8ClampedArray(raw.buffer ?? raw);
  if (buffer.length < width * height * 4) {
    return null;
  }

  ctx.putImageData(new ImageData(buffer, width, height), 0, 0);
  return imageCanvas.toDataURL("image/png");
};

export const renderStampLayerForPage = async (
  page: PDFPageProxy,
  container: HTMLDivElement,
  scale = 1.2,
) => {
  const viewport = getPageViewport(page, scale);
  container.innerHTML = "";
  container.style.width = `${viewport.width}px`;
  container.style.height = `${viewport.height}px`;

  const viewportAny = viewport as any;
  const annotations = await (page as any).getAnnotations({ intent: "display" });
  (annotations as Record<string, any>[])
    .filter((annotation: Record<string, any>) => isStampLikeAnnotation(annotation))
    .forEach((annotation: Record<string, any>, index: number) => {
      const [x1, y1, x2, y2] = annotation.rect ?? [0, 0, 0, 0];
      const topLeft = viewportAny.convertToViewportPoint(x1, y2);
      const bottomRight = viewportAny.convertToViewportPoint(x2, y1);
      const left = Math.min(topLeft[0], bottomRight[0]);
      const top = Math.min(topLeft[1], bottomRight[1]);
      const width = Math.abs(bottomRight[0] - topLeft[0]);
      const height = Math.abs(bottomRight[1] - topLeft[1]);

      const src =
        annotationBitmapToDataUrl(annotation as Record<string, any>) ??
        (annotation as Record<string, any>).imageUrl ??
        (annotation as Record<string, any>).url ??
        null;

      const stamp = document.createElement("img");
      stamp.dataset.annotationId = String(annotation.id ?? `stamp-${index}`);
      stamp.className = "pdf-stamp-item";
      stamp.draggable = false;
      stamp.style.position = "absolute";
      stamp.style.left = `${left}px`;
      stamp.style.top = `${top}px`;
      stamp.style.width = `${Math.max(1, width)}px`;
      stamp.style.height = `${Math.max(1, height)}px`;
      stamp.style.objectFit = "contain";
      stamp.alt = "stamp annotation";
      if (src) {
        stamp.src = src;
      }

      container.appendChild(stamp);
    });
};

const buildSvgPathElement = (
  svg: SVGElement,
  d: string,
  mode: "stroke" | "fill" | "fillStroke",
  state: GraphicsState,
  viewportMatrix: Matrix,
) => {
  if (!d.trim()) {
    return;
  }

  const pathEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
  pathEl.setAttribute("d", d.trim());

  const combined = multiplyMatrix(viewportMatrix, state.ctm);
  pathEl.setAttribute("transform", `matrix(${combined.join(" ")})`);

  const strokeWidth = Math.max(0.1, state.lineWidth * matrixScale(combined));
  pathEl.setAttribute("stroke-width", `${strokeWidth}`);

  if (mode === "stroke") {
    pathEl.setAttribute("fill", "none");
    pathEl.setAttribute("stroke", rgbCss(state.strokeColor));
  } else if (mode === "fill") {
    pathEl.setAttribute("fill", rgbCss(state.fillColor));
    pathEl.setAttribute("stroke", "none");
  } else {
    pathEl.setAttribute("fill", rgbCss(state.fillColor));
    pathEl.setAttribute("stroke", rgbCss(state.strokeColor));
  }

  svg.appendChild(pathEl);
};

const resolveImageDataUrl = async (page: any, objectId: string) => {
  const fromObj = page?.objs?.get?.(objectId) ?? page?.commonObjs?.get?.(objectId);
  if (!fromObj) {
    return null;
  }

  const imageData = fromObj.data ?? fromObj;
  const width = imageData.width;
  const height = imageData.height;
  const pixels = imageData.data;

  if (!width || !height || !pixels) {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }

  const imageBuffer =
    pixels instanceof Uint8ClampedArray ? pixels : new Uint8ClampedArray(pixels.buffer ?? pixels);
  if (imageBuffer.length < width * height * 4) {
    return null;
  }

  const img = new ImageData(imageBuffer, width, height);
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png");
};

export const renderPathLayerForPage = async (
  page: PDFPageProxy,
  container: HTMLDivElement,
  scale = 1.2,
) => {
  const viewport = getPageViewport(page, scale);
  container.innerHTML = "";
  container.style.width = `${viewport.width}px`;
  container.style.height = `${viewport.height}px`;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("viewBox", `0 0 ${viewport.width} ${viewport.height}`);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.style.position = "absolute";
  svg.style.inset = "0";

  const viewportMatrix = (viewport as any).transform as Matrix;
  const opList = await (page as any).getOperatorList({
    intent: "display",
    annotationMode: 0,
  });
  const fnArray = opList?.fnArray ?? [];
  const argsArray = opList?.argsArray ?? [];

  let state: GraphicsState = {
    strokeColor: { ...DEFAULT_STROKE },
    fillColor: { ...DEFAULT_FILL },
    lineWidth: 1,
    ctm: [...IDENTITY_MATRIX],
  };
  const stateStack: GraphicsState[] = [];

  let path = "";
  let currentX = 0;
  let currentY = 0;

  const flush = (mode: "stroke" | "fill" | "fillStroke") => {
    buildSvgPathElement(svg, path, mode, state, viewportMatrix);
    path = "";
  };

  const opSave = (OPS as any).save;
  const opRestore = (OPS as any).restore;
  const opTransform = (OPS as any).transform;
  const opSetStrokeRGB = (OPS as any).setStrokeRGBColor;
  const opSetFillRGB = (OPS as any).setFillRGBColor;
  const opSetStrokeGray = (OPS as any).setStrokeGray;
  const opSetFillGray = (OPS as any).setFillGray;
  const opSetStrokeCMYK = (OPS as any).setStrokeCMYKColor;
  const opSetFillCMYK = (OPS as any).setFillCMYKColor;
  const opSetLineWidth = (OPS as any).setLineWidth;
  const opMoveTo = (OPS as any).moveTo;
  const opLineTo = (OPS as any).lineTo;
  const opCurveTo = (OPS as any).curveTo;
  const opCurveTo2 = (OPS as any).curveTo2;
  const opCurveTo3 = (OPS as any).curveTo3;
  const opClosePath = (OPS as any).closePath;
  const opRectangle = (OPS as any).rectangle;
  const opStroke = (OPS as any).stroke;
  const opCloseStroke = (OPS as any).closeStroke;
  const opFill = (OPS as any).fill;
  const opEoFill = (OPS as any).eoFill;
  const opFillStroke = (OPS as any).fillStroke;
  const opEoFillStroke = (OPS as any).eoFillStroke;
  const opCloseFillStroke = (OPS as any).closeFillStroke;
  const opCloseEoFillStroke = (OPS as any).closeEOFillStroke;
  const opPaintImage = (OPS as any).paintImageXObject;
  const opPaintJpeg = (OPS as any).paintJpegXObject;

  for (let i = 0; i < fnArray.length; i += 1) {
    const fn = fnArray[i];
    const args = argsArray[i] ?? [];

    if (fn === opSave) {
      stateStack.push({
        strokeColor: { ...state.strokeColor },
        fillColor: { ...state.fillColor },
        lineWidth: state.lineWidth,
        ctm: [...state.ctm],
      });
      continue;
    }

    if (fn === opRestore) {
      const previous = stateStack.pop();
      if (previous) {
        state = previous;
      }
      continue;
    }

    if (fn === opTransform) {
      const [a, b, c, d, e, f] = args;
      state = {
        ...state,
        ctm: multiplyMatrix(state.ctm, [a, b, c, d, e, f]),
      };
      continue;
    }

    if (fn === opSetStrokeRGB) {
      const [r, g, b] = args;
      state = { ...state, strokeColor: { r: clamp(r), g: clamp(g), b: clamp(b) } };
      continue;
    }

    if (fn === opSetFillRGB) {
      const [r, g, b] = args;
      state = { ...state, fillColor: { r: clamp(r), g: clamp(g), b: clamp(b) } };
      continue;
    }

    if (fn === opSetStrokeGray) {
      const [g] = args;
      state = { ...state, strokeColor: { r: clamp(g), g: clamp(g), b: clamp(g) } };
      continue;
    }

    if (fn === opSetFillGray) {
      const [g] = args;
      state = { ...state, fillColor: { r: clamp(g), g: clamp(g), b: clamp(g) } };
      continue;
    }

    if (fn === opSetStrokeCMYK) {
      const [c, m, y, k] = args;
      state = { ...state, strokeColor: cmykToRgb(c, m, y, k) };
      continue;
    }

    if (fn === opSetFillCMYK) {
      const [c, m, y, k] = args;
      state = { ...state, fillColor: cmykToRgb(c, m, y, k) };
      continue;
    }

    if (fn === opSetLineWidth) {
      state = { ...state, lineWidth: Number(args[0] ?? 1) || 1 };
      continue;
    }

    if (fn === opMoveTo) {
      const [x, y] = args;
      currentX = x;
      currentY = y;
      path += `M ${x} ${y} `;
      continue;
    }

    if (fn === opLineTo) {
      const [x, y] = args;
      currentX = x;
      currentY = y;
      path += `L ${x} ${y} `;
      continue;
    }

    if (fn === opCurveTo) {
      const [x1, y1, x2, y2, x3, y3] = args;
      currentX = x3;
      currentY = y3;
      path += `C ${x1} ${y1} ${x2} ${y2} ${x3} ${y3} `;
      continue;
    }

    if (fn === opCurveTo2) {
      const [x2, y2, x3, y3] = args;
      path += `C ${currentX} ${currentY} ${x2} ${y2} ${x3} ${y3} `;
      currentX = x3;
      currentY = y3;
      continue;
    }

    if (fn === opCurveTo3) {
      const [x1, y1, x3, y3] = args;
      path += `C ${x1} ${y1} ${x3} ${y3} ${x3} ${y3} `;
      currentX = x3;
      currentY = y3;
      continue;
    }

    if (fn === opRectangle) {
      const [x, y, w, h] = args;
      path += `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z `;
      currentX = x;
      currentY = y;
      continue;
    }

    if (fn === opClosePath) {
      path += "Z ";
      continue;
    }

    if (fn === opStroke || fn === opCloseStroke) {
      flush("stroke");
      continue;
    }

    if (fn === opFill || fn === opEoFill) {
      flush("fill");
      continue;
    }

    if (
      fn === opFillStroke ||
      fn === opEoFillStroke ||
      fn === opCloseFillStroke ||
      fn === opCloseEoFillStroke
    ) {
      flush("fillStroke");
      continue;
    }

    if (fn === opPaintImage || fn === opPaintJpeg) {
      const objectId = String(args[0] ?? "");
      const dataUrl = await resolveImageDataUrl(page, objectId);
      if (!dataUrl) {
        continue;
      }

      const imageNode = document.createElementNS("http://www.w3.org/2000/svg", "image");
      const ctm = multiplyMatrix(viewportMatrix, state.ctm);
      imageNode.setAttributeNS("http://www.w3.org/1999/xlink", "href", dataUrl);
      imageNode.setAttribute("x", "0");
      imageNode.setAttribute("y", "-1");
      imageNode.setAttribute("width", "1");
      imageNode.setAttribute("height", "1");
      imageNode.setAttribute("preserveAspectRatio", "none");
      imageNode.setAttribute("transform", `matrix(${ctm.join(" ")})`);
      svg.appendChild(imageNode);
      continue;
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
