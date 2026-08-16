import React, { useEffect, useState, useRef, useCallback } from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { Maximize2, MoveDiagonal, Loader2 } from 'lucide-react';
import { getImageUrlForId } from '../db/imageRepository';

export function ImageNodeView({ node, updateAttributes, selected }: NodeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [resolvedSrc, setResolvedSrc] = useState<string>(node.attrs.src || '');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const dragStartXRef = useRef<number>(0);
  const initialWidthPxRef = useRef<number>(0);

  const width = node.attrs.width || '100%';
  const alt = node.attrs.alt || '';
  const imageId = node.attrs.imageId;

  // Resolve Blob URL from Dexie if imageId is provided and src is missing or expired
  useEffect(() => {
    let isCancelled = false;

    async function resolveBlob() {
      if (imageId) {
        setIsLoading(true);
        try {
          const url = await getImageUrlForId(Number(imageId));
          if (!isCancelled && url) {
            setResolvedSrc(url);
            // Also ensure node src attribute is updated for rendering
            if (node.attrs.src !== url) {
              updateAttributes({ src: url });
            }
          }
        } catch (e) {
          console.error('Failed to resolve image blob:', e);
        } finally {
          if (!isCancelled) setIsLoading(false);
        }
      } else if (node.attrs.src) {
        setResolvedSrc(node.attrs.src);
      }
    }

    resolveBlob();

    return () => {
      isCancelled = true;
    };
  }, [imageId, node.attrs.src, updateAttributes]);

  const handleStartResize = (clientX: number) => {
    if (!containerRef.current) return;
    setIsDragging(true);
    dragStartXRef.current = clientX;
    initialWidthPxRef.current = containerRef.current.getBoundingClientRect().width;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleStartResize(e.clientX);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      e.stopPropagation();
      handleStartResize(e.touches[0].clientX);
    }
  };

  const handleApplyPreset = (preset: string) => {
    updateAttributes({ width: preset });
  };

  const handlePointerUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      if (containerRef.current) {
        const finalPx = Math.round(containerRef.current.getBoundingClientRect().width);
        updateAttributes({ width: `${finalPx}px` });
      }
    }
  }, [isDragging, updateAttributes]);

  const handlePointerMove = useCallback(
    (clientX: number) => {
      if (!isDragging) return;
      const deltaX = clientX - dragStartXRef.current;
      const newPx = Math.max(160, Math.min(850, Math.round(initialWidthPxRef.current + deltaX)));
      updateAttributes({ width: `${newPx}px` });
    },
    [isDragging, updateAttributes]
  );

  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e: MouseEvent) => handlePointerMove(e.clientX);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) handlePointerMove(e.touches[0].clientX);
    };

    const onMouseUp = () => handlePointerUp();
    const onTouchEnd = () => handlePointerUp();

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onTouchEnd);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [isDragging, handlePointerMove, handlePointerUp]);

  return (
    <NodeViewWrapper
      as="div"
      className="my-3.5 flex justify-start select-none"
      data-drag-handle
    >
      <div
        ref={containerRef}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ width: width, maxWidth: '100%' }}
        className={`relative group rounded-lg overflow-hidden border transition-all duration-150 bg-brand-surface dark:bg-brand-surface-dark ${
          selected
            ? 'ring-2 ring-brand-accent border-brand-accent shadow-md'
            : 'border-brand-muted/20 dark:border-brand-muted/30'
        }`}
      >
        {isLoading && !resolvedSrc ? (
          <div className="h-40 flex items-center justify-center text-brand-muted gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-brand-accent" />
            <span className="text-xs">Loading image...</span>
          </div>
        ) : (
          <img
            src={resolvedSrc}
            alt={alt || 'Note image'}
            className="w-full h-auto block object-contain max-h-[600px] select-none rounded-lg"
            loading="lazy"
            draggable={false}
          />
        )}

        {alt && alt.trim().length > 0 && alt !== 'Image' && (
          <div className="px-3 py-1.5 text-xs text-brand-muted bg-brand-surface/90 dark:bg-brand-surface-dark/90 border-t border-brand-muted/15 dark:border-brand-muted/25 truncate select-text">
            {alt}
          </div>
        )}

        {/* Quick Size Presets Bar (Top-Right on Hover/Select) */}
        <div
          className={`absolute top-2 right-2 flex items-center gap-1 bg-brand-dark/85 dark:bg-brand-surface-dark/90 backdrop-blur-xs px-2 py-1 rounded-md border border-brand-muted/30 shadow-md transition-opacity duration-150 ${
            isHovered || isDragging || selected
              ? 'opacity-100 pointer-events-auto'
              : 'opacity-0 pointer-events-none'
          }`}
        >
          <button
            type="button"
            onClick={() => handleApplyPreset('280px')}
            className={`text-[10px] font-medium px-1 py-0.5 rounded cursor-pointer transition-colors ${
              width === '280px'
                ? 'text-brand-accent font-bold'
                : 'text-brand-light hover:text-brand-accent'
            }`}
            title="Small width (280px)"
          >
            Small
          </button>
          <span className="text-[10px] text-brand-muted/60">&middot;</span>
          <button
            type="button"
            onClick={() => handleApplyPreset('500px')}
            className={`text-[10px] font-medium px-1 py-0.5 rounded cursor-pointer transition-colors ${
              width === '500px'
                ? 'text-brand-accent font-bold'
                : 'text-brand-light hover:text-brand-accent'
            }`}
            title="Medium width (500px)"
          >
            Medium
          </button>
          <span className="text-[10px] text-brand-muted/60">&middot;</span>
          <button
            type="button"
            onClick={() => handleApplyPreset('100%')}
            className={`text-[10px] font-medium px-1 py-0.5 rounded cursor-pointer transition-colors flex items-center gap-0.5 ${
              width === '100%'
                ? 'text-brand-accent font-bold'
                : 'text-brand-light hover:text-brand-accent'
            }`}
            title="Full width (100%)"
          >
            <Maximize2 className="w-2.5 h-2.5" />
            <span>Full</span>
          </button>
        </div>

        {/* Interactive Resize Corner Drag Handle (Bottom-Right) */}
        <div
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          className={`absolute bottom-1 right-1 sm:bottom-1.5 sm:right-1.5 p-1.5 cursor-nwse-resize rounded-md select-none touch-none transition-all duration-150 flex items-center justify-center min-w-[36px] min-h-[36px] ${
            isHovered || isDragging || selected
              ? 'opacity-100 scale-100'
              : 'opacity-0 sm:opacity-40 scale-95'
          }`}
          title="Drag to resize image"
          aria-label="Resize image"
        >
          <div className="w-5 h-5 bg-brand-accent text-brand-light rounded flex items-center justify-center shadow-md border border-brand-light/20">
            <MoveDiagonal className="w-3 h-3 stroke-[2.5]" />
          </div>
        </div>
      </div>
    </NodeViewWrapper>
  );
}
