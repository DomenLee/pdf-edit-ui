import { getDocument, GlobalWorkerOptions, type PDFPageProxy } from "pdfjs-dist";

GlobalWorkerOptions.workerSrc = "/pdf.worker.js";

export const loadPdfPage = async (data: ArrayBuffer, pageNumber = 1) => {
  const loadingTask = getDocument({ data });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(pageNumber);
  return page;
};

export const getPageViewport = (page: PDFPageProxy, scale: number) => {
  return page.getViewport({ scale });
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

export const renderFirstPage = async (
  data: ArrayBuffer,
  canvas: HTMLCanvasElement,
) => {
  const page = await loadPdfPage(data, 1);
  return renderPage(page, canvas);
};
