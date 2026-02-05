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
type ColorSource =
  | "DeviceRGB"
  | "DeviceGray"
  | "DeviceCMYK"
  | "ICCBased"
  | "Separation"
  | "DeviceN"
  | "Pattern"
  | "Unknown";
type SemanticTextColor = {
  fillColorRGB: RgbColor;
  fillColorSource: ColorSource;
};
type SemanticTextRun = SemanticTextColor & {
  text: string;
};
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

const clampColorByte = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

const toByteRgb = ({ r, g, b }: RgbColor): RgbColor => ({
  r: clampColorByte(clamp(r) * 255),
  g: clampColorByte(clamp(g) * 255),
  b: clampColorByte(clamp(b) * 255),
});

const normalizeColorSpaceName = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object") {
    const maybeName = (value as { name?: unknown }).name;
    if (typeof maybeName === "string") {
      return maybeName;
    }
  }
  return "";
};

const resolveColorSource = (value: unknown): ColorSource => {
  const name = normalizeColorSpaceName(value);
  if (/DeviceRGB/i.test(name)) return "DeviceRGB";
  if (/DeviceGray/i.test(name)) return "DeviceGray";
  if (/DeviceCMYK/i.test(name)) return "DeviceCMYK";
  if (/ICCBased/i.test(name)) return "ICCBased";
  if (/Separation/i.test(name)) return "Separation";
  if (/DeviceN/i.test(name)) return "DeviceN";
  if (/Pattern/i.test(name)) return "Pattern";
  return "Unknown";
};

const convertPdfColorToRgb = (
  source: ColorSource,
  components: number[],
  iccComponents = 3,
): RgbColor => {
  if (source === "DeviceRGB") {
    return toByteRgb({
      r: components[0] ?? 0,
      g: components[1] ?? 0,
      b: components[2] ?? 0,
    });
  }

  if (source === "DeviceGray") {
    const g = clamp(components[0] ?? 0);
    return toByteRgb({ r: g, g, b: g });
  }

  if (source === "DeviceCMYK") {
    return toByteRgb(cmykToRgb(
      components[0] ?? 0,
      components[1] ?? 0,
      components[2] ?? 0,
      components[3] ?? 0,
    ));
  }

  if (source === "ICCBased") {
    if (iccComponents <= 1) {
      const g = clamp(components[0] ?? 0);
      return toByteRgb({ r: g, g, b: g });
    }
    if (iccComponents === 3) {
      return toByteRgb({
        r: components[0] ?? 0,
        g: components[1] ?? 0,
        b: components[2] ?? 0,
      });
    }
    if (iccComponents >= 4) {
      return toByteRgb(cmykToRgb(
        components[0] ?? 0,
        components[1] ?? 0,
        components[2] ?? 0,
        components[3] ?? 0,
      ));
    }
  }

  return { r: 17, g: 24, b: 39 };
};

const glyphObjectToUnicode = (glyph: unknown): string => {
  if (!glyph || typeof glyph !== "object") {
    return "";
  }
  const unicode = (glyph as { unicode?: unknown }).unicode;
  return typeof unicode === "string" ? unicode : "";
};

const getTextFromShowTextArgs = (fn: number, args: any[]): string => {
  const opShowText = (OPS as any).showText;
  const opShowSpacedText = (OPS as any).showSpacedText;
  const opNextLineShowText = (OPS as any).nextLineShowText;
  const opNextLineSetSpacingShowText = (OPS as any).nextLineSetSpacingShowText;

  if (fn === opShowText) {
    const glyphs = Array.isArray(args[0]) ? args[0] : [];
    return glyphs.map(glyphObjectToUnicode).join("");
  }

  if (fn === opShowSpacedText) {
    const chunks = Array.isArray(args[0]) ? args[0] : [];
    return chunks
      .filter((chunk) => typeof chunk === "object")
      .map(glyphObjectToUnicode)
      .join("");
  }

  if (fn === opNextLineShowText) {
    const glyphs = Array.isArray(args[0]) ? args[0] : [];
    return glyphs.map(glyphObjectToUnicode).join("");
  }

  if (fn === opNextLineSetSpacingShowText) {
    const glyphs = Array.isArray(args[2]) ? args[2] : [];
    return glyphs.map(glyphObjectToUnicode).join("");
  }

  return "";
};

const extractSemanticTextRuns = async (page: PDFPageProxy): Promise<SemanticTextRun[]> => {
  const opList = await (page as any).getOperatorList({
    intent: "display",
    annotationMode: 0,
  });

  const fnArray = opList?.fnArray ?? [];
  const argsArray = opList?.argsArray ?? [];

  const opSave = (OPS as any).save;
  const opRestore = (OPS as any).restore;
  const opSetFillColorSpace = (OPS as any).setFillColorSpace;
  const opSetFillRGB = (OPS as any).setFillRGBColor;
  const opSetFillGray = (OPS as any).setFillGray;
  const opSetFillCMYK = (OPS as any).setFillCMYKColor;
  const opSetFillColor = (OPS as any).setFillColor;
  const opSetFillColorN = (OPS as any).setFillColorN;
  const opShowText = (OPS as any).showText;
  const opShowSpacedText = (OPS as any).showSpacedText;
  const opNextLineShowText = (OPS as any).nextLineShowText;
  const opNextLineSetSpacingShowText = (OPS as any).nextLineSetSpacingShowText;

  const semanticRuns: SemanticTextRun[] = [];
  let currentColorSource: ColorSource = "DeviceGray";
  let currentColorComponents: number[] = [0];
  let currentICCComponents = 3;

  type ColorState = {
    currentColorSource: ColorSource;
    currentColorComponents: number[];
    currentICCComponents: number;
  };
  const colorStateStack: ColorState[] = [];

  for (let i = 0; i < fnArray.length; i += 1) {
    const fn = fnArray[i];
    const args = argsArray[i] ?? [];

    if (fn === opSave) {
      colorStateStack.push({
        currentColorSource,
        currentColorComponents: [...currentColorComponents],
        currentICCComponents,
      });
      continue;
    }

    if (fn === opRestore) {
      const prev = colorStateStack.pop();
      if (prev) {
        currentColorSource = prev.currentColorSource;
        currentColorComponents = prev.currentColorComponents;
        currentICCComponents = prev.currentICCComponents;
      }
      continue;
    }

    if (fn === opSetFillColorSpace) {
      currentColorSource = resolveColorSource(args[0]);
      if (currentColorSource === "ICCBased") {
        const maybeNumComps = Number((args[0] as { numComps?: unknown })?.numComps ?? 3);
        currentICCComponents = Number.isFinite(maybeNumComps) ? maybeNumComps : 3;
      }
      continue;
    }

    if (fn === opSetFillRGB) {
      currentColorSource = "DeviceRGB";
      currentColorComponents = [args[0] ?? 0, args[1] ?? 0, args[2] ?? 0];
      continue;
    }

    if (fn === opSetFillGray) {
      currentColorSource = "DeviceGray";
      currentColorComponents = [args[0] ?? 0];
      continue;
    }

    if (fn === opSetFillCMYK) {
      currentColorSource = "DeviceCMYK";
      currentColorComponents = [args[0] ?? 0, args[1] ?? 0, args[2] ?? 0, args[3] ?? 0];
      continue;
    }

    if (fn === opSetFillColor || fn === opSetFillColorN) {
      currentColorComponents = Array.isArray(args) ? args.map((v) => Number(v) || 0) : [0];
      continue;
    }

    if (
      fn === opShowText ||
      fn === opShowSpacedText ||
      fn === opNextLineShowText ||
      fn === opNextLineSetSpacingShowText
    ) {
      const text = getTextFromShowTextArgs(fn, args);
      if (!text) {
        continue;
      }

      semanticRuns.push({
        text,
        fillColorSource: currentColorSource,
        fillColorRGB: convertPdfColorToRgb(
          currentColorSource,
          currentColorComponents,
          currentICCComponents,
        ),
      });
    }
  }

  return semanticRuns;
};

const mapTextDivColors = (textDivs: HTMLElement[], semanticRuns: SemanticTextRun[]): SemanticTextColor[] => {
  const mapped: SemanticTextColor[] = [];
  let runIndex = 0;
  let runOffset = 0;

  for (const textDiv of textDivs) {
    const text = textDiv.textContent ?? "";
    const textLen = text.length;

    while (runIndex < semanticRuns.length && runOffset >= semanticRuns[runIndex].text.length) {
      runIndex += 1;
      runOffset = 0;
    }

    const currentRun = semanticRuns[runIndex];
    if (!currentRun) {
      mapped.push({
        fillColorSource: "Unknown",
        fillColorRGB: { r: 17, g: 24, b: 39 },
      });
      continue;
    }

    mapped.push({
      fillColorSource: currentRun.fillColorSource,
      fillColorRGB: currentRun.fillColorRGB,
    });

    runOffset += Math.max(1, textLen);
  }

  return mapped;
};
const TEMPLATE_RED = "#b00000";
const DATA_BLACK = "#000000";
const SECONDARY_GRAY = "#666666";


const INVOICE_LABEL_HINTS = [
  "发票",
  "名称",
  "代码",
  "号码",
  "日期",
  "税",
  "金额",
  "价税",
  "购",
  "销",
  "地址",
  "电话",
  "开户",
  "账号",
  "备注",
  "规格",
  "单位",
  "数量",
  "单价",
  "税率",
  "价款",
  "合计",
  "小写",
  "大写",
  "机器",
  "校验",
  "收款",
  "复核",
  "开票",
  "buyer",
  "seller",
  "invoice",
  "date",
  "amount",
  "tax",
  "total",
];

const isLikelyDataText = (rawText: string) => {
  const text = rawText.trim();
  if (!text) {
    return false;
  }

  if (/\d/.test(text)) {
    return true;
  }

  if (/[$¥€£]/.test(text)) {
    return true;
  }

  if (/^[A-Z0-9\-_/.:]{6,}$/i.test(text)) {
    return true;
  }

  if (/[:：]$/.test(text)) {
    return false;
  }

  const normalized = text.toLowerCase();
  if (INVOICE_LABEL_HINTS.some((hint) => normalized.includes(hint))) {
    return false;
  }

  if (/^[一-龥]{1,8}$/.test(text)) {
    return false;
  }

  return text.length > 8;
};

const normalizeRotation = (rotation: number) => {
  const normalized = ((rotation % 360) + 360) % 360;
  return normalized;
};

const detectInvoicePDF = (textContent: any) => {
  const normalizedText = String(
    textContent?.items?.map((item: any) => item?.str ?? "").join(" ") ?? "",
  ).toLowerCase();
  return normalizedText.includes("发票") && (
    normalizedText.includes("代码") ||
    normalizedText.includes("号码") ||
    normalizedText.includes("tax") ||
    normalizedText.includes("invoice")
  );
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
  const semanticTextRuns = await extractSemanticTextRuns(page);
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

  const semanticTextColors = mapTextDivColors(textDivs, semanticTextRuns);
  const isInvoicePDF = detectInvoicePDF(textContent);
  const previousInvoiceEditCleanup = (container as any).__invoiceEditCleanup;
  if (typeof previousInvoiceEditCleanup === "function") {
    previousInvoiceEditCleanup();
  }
  delete (container as any).__invoiceEditCleanup;

  const COVER_SCALE = 1.01;

  if (isInvoicePDF) {
    const clearEditingOutline = () => {
      textDivs.forEach((div) => {
        div.style.outline = "none";
        div.style.outlineOffset = "0px";
      });
    };

    const updateEditingOutline = () => {
      clearEditingOutline();
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        return;
      }

      const anchorElement = selection.anchorNode instanceof Element
        ? selection.anchorNode
        : selection.anchorNode?.parentElement;
      const activeSpan = anchorElement?.closest("span");
      if (!(activeSpan instanceof HTMLElement) || !container.contains(activeSpan)) {
        return;
      }

      if (document.activeElement !== container && !container.contains(document.activeElement)) {
        return;
      }

      activeSpan.style.outline = "1px solid #1677ff";
      activeSpan.style.outlineOffset = "1px";
    };

    document.addEventListener("selectionchange", updateEditingOutline);
    container.addEventListener("focusin", updateEditingOutline);
    container.addEventListener("focusout", clearEditingOutline);
    container.addEventListener("keyup", updateEditingOutline);
    container.addEventListener("mouseup", updateEditingOutline);

    (container as any).__invoiceEditCleanup = () => {
      document.removeEventListener("selectionchange", updateEditingOutline);
      container.removeEventListener("focusin", updateEditingOutline);
      container.removeEventListener("focusout", clearEditingOutline);
      container.removeEventListener("keyup", updateEditingOutline);
      container.removeEventListener("mouseup", updateEditingOutline);
      clearEditingOutline();
    };
  }

  textDivs.forEach((textDiv, textDivIndex) => {
    const currentSize = Number.parseFloat(textDiv.style.fontSize || "0");
    if (Number.isFinite(currentSize) && currentSize > 0) {
      textDiv.style.fontSize = `${currentSize * COVER_SCALE}px`;
    }

    textDiv.style.lineHeight = "1";
    textDiv.style.whiteSpace = "pre";
    textDiv.style.background = "none";
    textDiv.style.textShadow = "0 0 0 #fff, 0 0 1px #fff, 0 0 2px #fff";
    textDiv.style.outline = "none";

    const textRole = isLikelyDataText(textDiv.textContent ?? "") ? "data" : "template";
    textDiv.dataset.textRole = textRole;

    if (isInvoicePDF) {
      const templateColor = textRole === "template"
        ? TEMPLATE_RED
        : textRole === "data"
          ? DATA_BLACK
          : SECONDARY_GRAY;
      textDiv.style.color = templateColor;
      textDiv.style.caretColor = templateColor;
      textDiv.style.fontFamily = '"宋体", SimSun, serif';
      return;
    }

    const semanticColor = semanticTextColors[textDivIndex];
    const resolvedColor = semanticColor?.fillColorRGB ?? { r: 17, g: 24, b: 39 };
    textDiv.dataset.fillColorSource = semanticColor?.fillColorSource ?? "Unknown";
    textDiv.style.color = `rgb(${resolvedColor.r}, ${resolvedColor.g}, ${resolvedColor.b})`;
    textDiv.style.caretColor = `rgb(${resolvedColor.r}, ${resolvedColor.g}, ${resolvedColor.b})`;
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
