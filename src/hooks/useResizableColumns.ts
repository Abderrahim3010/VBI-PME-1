import { useState, useCallback, useEffect, useRef } from 'react';

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
  const columnWidthsRef = useRef(columnWidths);
  const activeFinishRef = useRef<(() => void) | null>(null);
  const previousBodyStylesRef = useRef({ userSelect: '', webkitUserSelect: '', cursor: '' });
  const optionsRef = useRef({ initialWidths, minWidth, storageKey });

  optionsRef.current = { initialWidths, minWidth, storageKey };

  useEffect(() => {
    columnWidthsRef.current = columnWidths;
  }, [columnWidths]);

  useEffect(() => {
    return () => {
      activeFinishRef.current?.();
    };
  }, []);

  const startResizing = useCallback((colKey: T, startX: number) => {
    const options = optionsRef.current;
    activeFinishRef.current?.();
    isResizingRef.current = true;
    currentColKeyRef.current = colKey;
    startXRef.current = startX;

    startWidthRef.current = columnWidthsRef.current[colKey] ?? options.initialWidths[colKey] ?? 100;

    previousBodyStylesRef.current = {
      userSelect: document.body.style.userSelect,
      webkitUserSelect: document.body.style.webkitUserSelect,
      cursor: document.body.style.cursor
    };

    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
    document.body.style.cursor = 'col-resize';

    const onMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current || !currentColKeyRef.current) return;
      const deltaX = e.clientX - startXRef.current;
      const newWidth = Math.max(options.minWidth, startWidthRef.current + deltaX);
      const targetCol = currentColKeyRef.current;

      setColumnWidths(prev => {
        const updated = { ...prev, [targetCol]: newWidth };
        columnWidthsRef.current = updated;
        return updated;
      });
    };

    let finished = false;
    const finishResizing = () => {
      if (finished) return;
      finished = true;
      isResizingRef.current = false;
      currentColKeyRef.current = null;
      document.body.style.userSelect = previousBodyStylesRef.current.userSelect;
      document.body.style.webkitUserSelect = previousBodyStylesRef.current.webkitUserSelect;
      document.body.style.cursor = previousBodyStylesRef.current.cursor;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', finishResizing);
      window.removeEventListener('pointerup', finishResizing);
      window.removeEventListener('pointercancel', finishResizing);
      window.removeEventListener('blur', finishResizing);
      activeFinishRef.current = null;

      if (options.storageKey) {
        try {
          localStorage.setItem(`col_widths_${options.storageKey}`, JSON.stringify(columnWidthsRef.current));
        } catch {}
      }
    };

    activeFinishRef.current = finishResizing;

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', finishResizing);
    window.addEventListener('pointerup', finishResizing);
    window.addEventListener('pointercancel', finishResizing);
    window.addEventListener('blur', finishResizing);
  }, []);

  return { columnWidths, startResizing };
}

