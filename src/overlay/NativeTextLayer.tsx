import { useEffect, useMemo, useRef } from "react";
import { NativeTextReplacement } from "./objects/types";
import { useNativeTextStore } from "../state/nativeTextStore";
import { cn } from "../components/ui/utils";

export type NativeTextBlock = {
  id: string;
  pageIndex: number;
  text: string;
  bbox: { x: number; y: number; width: number; height: number };
  fontSize: number;
};

type NativeTextLayerProps = {
  width: number;
  height: number;
  blocks: NativeTextBlock[];
};

export const NativeTextLayer = ({ width, height, blocks }: NativeTextLayerProps) => {
  const activeEditingTextId = useNativeTextStore(
    (state) => state.activeEditingTextId,
  );
  const setActiveEditingTextId = useNativeTextStore(
    (state) => state.setActiveEditingTextId,
  );
  const nativeTextReplacements = useNativeTextStore(
    (state) => state.nativeTextReplacements,
  );
  const upsertReplacement = useNativeTextStore(
    (state) => state.upsertReplacement,
  );

  const blockMap = useMemo(() => {
    return new Map(blocks.map((block) => [block.id, block]));
  }, [blocks]);

  const activeBlock = activeEditingTextId
    ? blockMap.get(activeEditingTextId)
    : undefined;

  const replacementMap = useMemo(() => {
    return new Map(
      nativeTextReplacements.map((replacement) => [replacement.id, replacement]),
    );
  }, [nativeTextReplacements]);

  const activeReplacement = activeEditingTextId
    ? replacementMap.get(activeEditingTextId)
    : undefined;

  const editableRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!activeBlock || !editableRef.current) {
      return;
    }
    editableRef.current.focus();
    const range = document.createRange();
    range.selectNodeContents(editableRef.current);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [activeBlock]);

  const handleCommit = (value: string) => {
    if (!activeBlock) {
      return;
    }
    const next: NativeTextReplacement = {
      id: activeBlock.id,
      type: "native-text-replacement",
      pageIndex: activeBlock.pageIndex,
      originalText: activeBlock.text,
      replacementText: value,
      originalBBox: activeBlock.bbox,
      fontSize: activeBlock.fontSize,
    };
    upsertReplacement(next);
    setActiveEditingTextId(null);
  };

  return (
    <div className="absolute left-0 top-0" style={{ width, height }}>
      {blocks.map((block) => {
        const isEditing = block.id === activeEditingTextId;
        if (isEditing) {
          return null;
        }
        return (
          <button
            key={block.id}
            type="button"
            className="native-text-hit-area"
            style={{
              left: block.bbox.x,
              top: block.bbox.y,
              width: block.bbox.width,
              height: block.bbox.height,
            }}
            onClick={() => setActiveEditingTextId(block.id)}
          />
        );
      })}
      {activeBlock && (
        <div className="absolute left-0 top-0">
          <div
            className="absolute bg-white"
            style={{
              left: activeBlock.bbox.x,
              top: activeBlock.bbox.y,
              width: activeBlock.bbox.width,
              height: activeBlock.bbox.height,
            }}
          />
          <div
            ref={editableRef}
            className={cn(
              "absolute select-text whitespace-nowrap bg-transparent text-foreground outline-none",
            )}
            style={{
              left: activeBlock.bbox.x,
              top: activeBlock.bbox.y,
              width: activeBlock.bbox.width,
              height: activeBlock.bbox.height,
              fontSize: activeBlock.fontSize,
              lineHeight: `${activeBlock.bbox.height}px`,
            }}
            contentEditable
            suppressContentEditableWarning
            onBlur={(event) =>
              handleCommit(event.currentTarget.textContent ?? "")
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleCommit(event.currentTarget.textContent ?? "");
              }
            }}
          >
            {activeReplacement?.replacementText ?? activeBlock.text}
          </div>
        </div>
      )}
    </div>
  );
};
