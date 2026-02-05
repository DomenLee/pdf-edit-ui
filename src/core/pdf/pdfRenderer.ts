import {
  getDocument,
  GlobalWorkerOptions,
  OPS,
  type PDFPageProxy,
} from "pdfjs-dist";

GlobalWorkerOptions.workerSrc = "/pdf.worker.js";
const baseUrl = import.meta.env.BASE_URL ?? "/";
const cMapUrl = `${baseUrl}cmaps/`;
const standardFontDataUrl = `${baseUrl}standard_fonts/`;

type Matrix = [number, number, number, number, number, number];
type TextLayerSpanDescriptor = {
  text: string;
  transform: string;
  fontSizePx: number;
  fontFamily: string;
  color: string;
  textId: string;
  pageIndex: number;
};

type TextGroup = {
  text: string;
  xPdf: number;
  yPdf: number;
  widthPdf: number;
  fontSizePdf: number;
  fontName: string;
  angleRad: number;
  color: string;
};
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
  scale = 1.2,
) => {
  const viewport = getPageViewport(page, scale);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("无法获取 2D Context");
  }

  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const operatorList = await (page as any).getOperatorList();
  const fnArray: number[] = operatorList?.fnArray ?? [];
  const textRenderingOps = new Set<number>([
    (OPS as any).beginText,
    (OPS as any).endText,
    (OPS as any).setFont,
    (OPS as any).setTextMatrix,
    (OPS as any).setTextRise,
    (OPS as any).setWordSpacing,
    (OPS as any).setCharSpacing,
    (OPS as any).setTextRenderingMode,
    (OPS as any).setTextLeading,
    (OPS as any).moveText,
    (OPS as any).setHScale,
    (OPS as any).nextLine,
    (OPS as any).showText,
    (OPS as any).showSpacedText,
    (OPS as any).nextLineShowText,
    (OPS as any).nextLineSetSpacingShowText,
    (OPS as any).setLeadingMoveText,
  ]);

  await page
    .render({
      canvasContext: context,
      viewport,
      operationsFilter: (index: number) => {
        const fn = fnArray[index];
        if (!Number.isFinite(fn)) {
          return true;
        }
        return !textRenderingOps.has(fn);
      },
    } as any)
    .promise;

  const backgroundImageDataUrl = canvas.toDataURL("image/png");
  return {
    width: viewport.width,
    height: viewport.height,
    scale,
    pageHeight: ((page as any).view?.[3] ?? viewport.height / scale) - ((page as any).view?.[1] ?? 0),
    backgroundImageDataUrl,
  };
};

const toCssColor = (rgb: RgbColor, alpha = 1) =>
  `rgba(${Math.round(clamp(rgb.r) * 255)},${Math.round(clamp(rgb.g) * 255)},${Math.round(clamp(rgb.b) * 255)},${Math.max(0, Math.min(1, alpha))})`;

const extractTextPaintColors = async (page: PDFPageProxy) => {
  const opList = await (page as any).getOperatorList();
  const fnArray: number[] = opList?.fnArray ?? [];
  const argsArray: any[] = opList?.argsArray ?? [];
  const colors: string[] = [];

  const opSetFillRGB = (OPS as any).setFillRGBColor;
  const opSetFillGray = (OPS as any).setFillGray;
  const opSetFillCMYK = (OPS as any).setFillCMYKColor;
  const opSetFillAlpha = (OPS as any).setFillAlpha;
  const opShowText = (OPS as any).showText;
  const opShowSpacedText = (OPS as any).showSpacedText;
  const opNextLineShowText = (OPS as any).nextLineShowText;
  const opNextLineSetSpacingShowText = (OPS as any).nextLineSetSpacingShowText;

  let fillColor: RgbColor = { ...DEFAULT_FILL };
  let fillAlpha = 1;

  for (let i = 0; i < fnArray.length; i += 1) {
    const fn = fnArray[i];
    const args = argsArray[i] ?? [];

    if (fn === opSetFillRGB) {
      fillColor = { r: clamp(args[0] ?? 0), g: clamp(args[1] ?? 0), b: clamp(args[2] ?? 0) };
      continue;
    }
    if (fn === opSetFillGray) {
      const gray = clamp(args[0] ?? 0);
      fillColor = { r: gray, g: gray, b: gray };
      continue;
    }
    if (fn === opSetFillCMYK) {
      fillColor = cmykToRgb(args[0] ?? 0, args[1] ?? 0, args[2] ?? 0, args[3] ?? 0);
      continue;
    }
    if (fn === opSetFillAlpha) {
      fillAlpha = Math.max(0, Math.min(1, Number(args[0] ?? 1)));
      continue;
    }

    if (
      fn === opShowText ||
      fn === opShowSpacedText ||
      fn === opNextLineShowText ||
      fn === opNextLineSetSpacingShowText
    ) {
      colors.push(toCssColor(fillColor, fillAlpha));
    }
  }

  return colors;
};

const createTextLayerDescriptors = (
  items: any[],
  colors: string[],
  pageHeight: number,
  scale: number,
): TextLayerSpanDescriptor[] => {
  const groups: TextGroup[] = [];
  const lineThresholdPdf = 1.25;
  const gapFactor = 0.35;

  items.forEach((item, index) => {
    const text = String(item?.str ?? "");
    if (!text) {
      return;
    }

    const transform = item.transform as Matrix;
    const xPdf = Number(transform[4] ?? 0);
    const yPdf = Number(transform[5] ?? 0);
    const fontSizePdf = Math.hypot(Number(transform[2] ?? 0), Number(transform[3] ?? 0));
    const widthPdf = Number(item.width ?? 0);
    const angleRad = Math.atan2(Number(transform[1] ?? 0), Number(transform[0] ?? 1));
    const fontName = String(item.fontName ?? "sans-serif");
    const color = colors[index] ?? "rgba(17,24,39,1)";

    const previous = groups[groups.length - 1];
    if (!previous) {
      groups.push({ text, xPdf, yPdf, widthPdf, fontSizePdf, fontName, angleRad, color });
      return;
    }

    const sameLine = Math.abs(previous.yPdf - yPdf) <= lineThresholdPdf;
    const sameFont = previous.fontName === fontName;
    const sameSize = Math.abs(previous.fontSizePdf - fontSizePdf) <= 0.35;
    const sameAngle = Math.abs(previous.angleRad - angleRad) <= 0.01;
    const sameColor = previous.color === color;
    const expectedNextXPdf = previous.xPdf + previous.widthPdf;
    const gapPdf = Math.abs(xPdf - expectedNextXPdf);
    const allowedGapPdf = Math.max(0.75, fontSizePdf * gapFactor);
    const shouldMerge = sameLine && sameFont && sameSize && sameAngle && sameColor && gapPdf <= allowedGapPdf;

    if (!shouldMerge) {
      groups.push({ text, xPdf, yPdf, widthPdf, fontSizePdf, fontName, angleRad, color });
      return;
    }

    previous.text += text;
    previous.widthPdf = Math.max(previous.widthPdf + widthPdf, xPdf + widthPdf - previous.xPdf);
  });

  return groups.map((group, index) => {
    const baselineCorrection = group.fontSizePdf * 0.8;
    // PDF 文本锚点是基线附近，DOM translate 锚点是盒子左上角，因此这里做统一 baseline 经验修正。
    const x = group.xPdf * scale;
    const y = (pageHeight - group.yPdf - baselineCorrection) * scale;
    // 浏览器字体与 PDF 子集字体会有字宽偏差，这里先写入期望宽度，后续在 DOM 里做 scaleX 纠偏。
    const expectedWidthPx = Math.max(0, group.widthPdf * scale);

    return {
      text: group.text,
      transform: `translate(${x}px, ${y}px) rotate(${group.angleRad}rad)`,
      fontSizePx: group.fontSizePdf * scale,
      fontFamily: group.fontName,
      color: group.color,
      textId: `text-${index}`,
      pageIndex: 0,
      expectedWidthPx,
    } as TextLayerSpanDescriptor & { expectedWidthPx: number };
  });
};

export const renderTextLayerForPage = async (
  page: PDFPageProxy,
  container: HTMLDivElement,
  pageHeight: number,
  scale = 1.2,
) => {
  const viewport = getPageViewport(page, scale);
  container.innerHTML = "";
  container.style.width = `${viewport.width}px`;
  container.style.height = `${viewport.height}px`;
  container.style.transformOrigin = "0 0";
  const textContent = await (page as any).getTextContent();
  const textColors = await extractTextPaintColors(page);
  const spanDescriptors = createTextLayerDescriptors(
    textContent.items ?? [],
    textColors,
    pageHeight,
    scale,
  ) as Array<TextLayerSpanDescriptor & { expectedWidthPx: number }>;

  spanDescriptors.forEach((descriptor) => {
    const span = document.createElement("span");
    span.textContent = descriptor.text;
    span.dataset.textId = descriptor.textId;
    span.dataset.pageIndex = `${descriptor.pageIndex}`;
    span.dataset.originalText = descriptor.text;
    span.contentEditable = "true";
    span.style.transformOrigin = "0 0";
    span.style.transform = descriptor.transform;
    span.style.fontSize = `${descriptor.fontSizePx}px`;
    span.style.fontFamily = descriptor.fontFamily;
    span.style.color = descriptor.color;
    span.style.whiteSpace = "pre";

    container.appendChild(span);

    const measuredWidth = span.getBoundingClientRect().width;
    if (measuredWidth <= 0 || descriptor.expectedWidthPx <= 0) {
      return;
    }
    const scaleX = descriptor.expectedWidthPx / measuredWidth;
    // PDF 字符宽和浏览器排版宽不一致时，使用 scaleX 做横向纠偏，避免行内累计漂移。
    span.style.transform = `${descriptor.transform} scaleX(${scaleX})`;
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
  const opList = await (page as any).getOperatorList();
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
) => {
  const page = await loadPdfPage(data, 1);
  return renderPage(page);
};
