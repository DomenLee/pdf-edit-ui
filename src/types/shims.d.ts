declare module "react" {
  export as namespace React;
  export type ReactNode = any;
  export type Key = string | number;
  export type Ref<T> =
    | ((instance: T | null) => void)
    | { current: T | null }
    | null;
  export type RefObject<T> = { current: T | null };

  export interface Attributes {
    key?: Key;
  }

  export interface HTMLAttributes<T> {
    onBlur?: (event: FocusEvent<T>) => void;
    onClick?: (event: MouseEvent<T>) => void;
    onPointerDown?: (event: PointerEvent<T>) => void;
    onPointerMove?: (event: PointerEvent<T>) => void;
    onPointerUp?: (event: PointerEvent<T>) => void;
    onPointerLeave?: (event: PointerEvent<T>) => void;
    [key: string]: any;
  }

  export interface ButtonHTMLAttributes<T> extends HTMLAttributes<T> {
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
  }

  export interface PointerEvent<T = Element> {
    currentTarget: T;
    clientX: number;
    clientY: number;
    stopPropagation: () => void;
  }

  export interface MouseEvent<T = Element> {
    currentTarget: T;
    clientX: number;
    clientY: number;
    stopPropagation: () => void;
  }

  export interface ChangeEvent<T = Element> {
    target: T;
    currentTarget: T;
  }

  export interface FocusEvent<T = Element> {
    currentTarget: T;
  }

  export type Dispatch<A> = (value: A) => void;
  export type SetStateAction<S> = S | ((prevState: S) => S);

  export function useState<S>(
    initial: S | (() => S),
  ): [S, Dispatch<SetStateAction<S>>];
  export function useEffect(
    effect: () => void | (() => void),
    deps?: ReadonlyArray<unknown>,
  ): void;
  export function useMemo<T>(
    factory: () => T,
    deps: ReadonlyArray<unknown>,
  ): T;
  export function useRef<T>(initial: T): { current: T };
  export function createContext<T>(defaultValue: T): any;
  export function useContext<T>(context: any): T;
  export function forwardRef<T, P = {}>(
    render: (props: P, ref: Ref<T>) => ReactNode,
  ): ((props: P & { ref?: Ref<T> }) => ReactNode) & {
    displayName?: string;
  };

  export type ElementRef<T> = any;
  export type ComponentPropsWithoutRef<T> = any;

  export const Fragment: any;
  export const StrictMode: any;
}

declare namespace JSX {
  interface IntrinsicAttributes {
    key?: import("react").Key;
  }

  interface IntrinsicElements {
    [elemName: string]: import("react").HTMLAttributes<any>;
  }
}

declare namespace React {
  export type PointerEvent<T = Element> = import("react").PointerEvent<T>;
  export type MouseEvent<T = Element> = import("react").MouseEvent<T>;
  export type ChangeEvent<T = Element> = import("react").ChangeEvent<T>;
  export type FocusEvent<T = Element> = import("react").FocusEvent<T>;
  export type HTMLAttributes<T> = import("react").HTMLAttributes<T>;
  export type ButtonHTMLAttributes<T> =
    import("react").ButtonHTMLAttributes<T>;
  export type ElementRef<T> = import("react").ElementRef<T>;
  export type ComponentPropsWithoutRef<T> =
    import("react").ComponentPropsWithoutRef<T>;
  export type RefObject<T> = import("react").RefObject<T>;
}

declare module "react-dom/client" {
  export function createRoot(
    container: Element | DocumentFragment,
  ): { render: (node: import("react").ReactNode) => void };
}

declare module "react-router-dom" {
  export const BrowserRouter: any;
  export const Route: any;
  export const Routes: any;
  export function useParams<
    T extends Record<string, string | undefined> = Record<
      string,
      string | undefined
    >,
  >(): T;
  export function useNavigate(): (path: string) => void;
}

declare module "pdf-lib" {
  export class PDFDocument {
    static load(data: ArrayBuffer): Promise<PDFDocument>;
    getPage(index: number): {
      getSize(): { width: number; height: number };
      drawText: (text: string, options: any) => void;
      drawRectangle: (options: any) => void;
    };
    save(): Promise<Uint8Array>;
  }

  export function rgb(
    r: number,
    g: number,
    b: number,
  ): { r: number; g: number; b: number };
}

declare module "pdfjs-dist" {
  export type PDFPageProxy = {
    getViewport: (options: {
      scale: number;
      rotation?: number;
    }) => { width: number; height: number };
    rotate?: number;
    render: (options: {
      canvasContext: CanvasRenderingContext2D;
      viewport: { width: number; height: number };
    }) => { promise: Promise<void> };
  };

  export const GlobalWorkerOptions: { workerSrc: string };

  export function getDocument(options: {
    data: ArrayBuffer;
    cMapUrl?: string;
    cMapPacked?: boolean;
    standardFontDataUrl?: string;
    enableXfa?: boolean;
    useSystemFonts?: boolean;
  }): {
    promise: Promise<{
      getPage: (pageNumber: number) => Promise<PDFPageProxy>;
    }>;
  };
}

declare module "zustand" {
  export type StoreHook<T> = {
    (): T;
    <U>(selector: (state: T) => U): U;
    getState: () => T;
  };

  export type SetState<T> = (
    partial: Partial<T> | ((state: T) => Partial<T>),
  ) => void;

  export function create<T>(
    initializer: (set: SetState<T>, get: () => T) => T,
  ): StoreHook<T>;
}

declare module "idb" {
  export type IDBPDatabase = {
    objectStoreNames: { contains: (name: string) => boolean };
    createObjectStore: (name: string, options?: any) => void;
    put: (store: string, value: unknown) => Promise<void>;
    get: (store: string, key: string) => Promise<unknown>;
  };

  export function openDB(
    name: string,
    version: number,
    options: { upgrade: (db: IDBPDatabase) => void },
  ): Promise<IDBPDatabase>;
}

declare module "class-variance-authority" {
  export function cva(
    base: string,
    options?: Record<string, unknown>,
  ): (options?: Record<string, unknown>) => string;

  export type VariantProps<T> = T extends (...args: any) => any
    ? Record<string, unknown>
    : Record<string, unknown>;
}

declare module "clsx" {
  export type ClassValue =
    | string
    | number
    | boolean
    | null
    | undefined
    | ClassValue[]
    | { [key: string]: unknown };
  export function clsx(...inputs: unknown[]): string;
}

declare module "tailwind-merge" {
  export function twMerge(...inputs: string[]): string;
}

declare module "@radix-ui/react-slot" {
  export const Slot: any;
}

declare module "@radix-ui/react-toggle" {
  export const Root: any;
}

declare module "lucide-react" {
  export const Undo2: any;
  export const Redo2: any;
  export const Type: any;
  export const Highlighter: any;
  export const MousePointer2: any;
  export const Download: any;
  export const Languages: any;
}

declare module "react/jsx-runtime" {
  export const Fragment: any;
  export function jsx(...args: any[]): any;
  export function jsxs(...args: any[]): any;
}

declare module "vite/client" {
  interface ImportMetaEnv {
    readonly [key: string]: string | undefined;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}
