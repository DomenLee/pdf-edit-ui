import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "./utils";

type DropdownMenuContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const DropdownMenuContext = createContext<DropdownMenuContextValue | null>(null);

export const DropdownMenu = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenuContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-flex">{children}</div>
    </DropdownMenuContext.Provider>
  );
};

export const DropdownMenuTrigger = ({
  asChild,
  children,
}: {
  asChild?: boolean;
  children: ReactNode;
}) => {
  const context = useContext(
    DropdownMenuContext,
  ) as DropdownMenuContextValue | null;
  if (!context) {
    return null;
  }
  const { open, setOpen } = context;
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      type={asChild ? undefined : "button"}
      onClick={() => setOpen(!open)}
      aria-expanded={open}
    >
      {children}
    </Comp>
  );
};

export const DropdownMenuContent = ({
  children,
  className,
  align = "start",
}: {
  children: ReactNode;
  className?: string;
  align?: "start" | "end";
}) => {
  const context = useContext(
    DropdownMenuContext,
  ) as DropdownMenuContextValue | null;
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!context?.open) {
      return;
    }
    const handleClick = (event: MouseEvent) => {
      if (
        contentRef.current &&
        event.target instanceof Node &&
        !contentRef.current.contains(event.target)
      ) {
        context.setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [context]);

  if (!context?.open) {
    return null;
  }

  return (
    <div
      ref={contentRef}
      className={cn(
        "absolute z-50 mt-2 min-w-[8rem] rounded-md border border-border bg-card p-1 text-foreground shadow-md",
        align === "end" ? "right-0" : "left-0",
        className,
      )}
    >
      {children}
    </div>
  );
};

export const DropdownMenuItem = ({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) => {
  const context = useContext(
    DropdownMenuContext,
  ) as DropdownMenuContextValue | null;
  return (
    <button
      type="button"
      className={cn(
        "flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground",
        className,
      )}
      onClick={() => {
        onClick?.();
        context?.setOpen(false);
      }}
    >
      {children}
    </button>
  );
};
