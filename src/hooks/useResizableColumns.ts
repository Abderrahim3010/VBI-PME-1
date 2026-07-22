import { useState, useCallback, useRef } from 'react';

export function useResizableColumns<T extends string>(
  initialWidths: Record<T, number>,
  minWidth: number = 20,
  storageKey?: string
) {
  const [columnWidths, setColumnWidths] = useState<Record<T, number>>(() => {
    if (storageKey) {
      try {
        const saved = localStorage.getItem(`col_widths_${storageKey}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          return { ...initialWidths, ...parsed };
        }
      } catch (e) {
        // Fallback to initial
      }
    }
    return initialWidths;
  });

  const isResizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const currentColKeyRef = useRef<T | null>(null);

  const startResizing = useCallback((colKey: T, startX: number) => {
    isResizingRef.current = true;
    currentColKeyRef.current = colKey;
    startXRef.current = startX;

    setColumnWidths(prev => {
      startWidthRef.current = prev[colKey] ?? initialWidths[colKey] ?? 100;
      return prev;
    });

    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
    document.body.style.cursor = 'col-resize';

    const onMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current || !currentColKeyRef.current) return;
      const deltaX = e.clientX - startXRef.current;
      const newWidth = Math.max(minWidth, startWidthRef.current + deltaX);
      const targetCol = currentColKeyRef.current;

      setColumnWidths(prev => {
        const updated = { ...prev, [targetCol]: newWidth };
        if (storageKey) {
          try {
            localStorage.setItem(`col_widths_${storageKey}`, JSON.stringify(updated));
          } catch (err) {}
        }
        return updated;
      });
    };

    const onMouseUp = () => {
      isResizingRef.current = false;
      currentColKeyRef.current = null;
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [initialWidths, minWidth, storageKey]);

  return { columnWidths, startResizing };
}

