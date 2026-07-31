import React, { useCallback, useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface WindowFrameProps {
  id: string;
  title: string;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
  initialX: number;
  initialY: number;
  width?: string;
  height?: string;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onFocus: () => void;
  children: React.ReactNode;
  scale?: number;
  overflowVisible?: boolean;
}

// Helper to extract default sizes from Tailwind helper strings such as w-[800px]
function parseTailwindLength(cls: string, fallback: number): number {
  const match = cls.match(/^[wh]-\[(\d+)px\]/);
  if (match) {
    return parseInt(match[1]);
  }
  return fallback;
}

export default function WindowFrame({
  id,
  title,
  isOpen,
  isMinimized,
  isMaximized,
  zIndex,
  initialX,
  initialY,
  width = 'w-[800px]',
  height = 'h-[500px]',
  onClose,
  onMinimize,
  onMaximize,
  onFocus,
  children,
  scale = 1,
  overflowVisible = false
}: WindowFrameProps) {
  window.__vbiPerfRecorder?.render('WindowFrame', {
    instanceId: id,
    isOpen,
    isMinimized
  });

  const [position, setPosition] = useState({ x: initialX, y: initialY });
  const windowRef = useRef<HTMLDivElement>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);

  // High performance sizing state
  const [size, setSize] = useState(() => {
    const defaultW = parseTailwindLength(width, 800);
    const defaultH = parseTailwindLength(height, 500);
    return { width: defaultW, height: defaultH };
  });

  const hasManuallyDraggedRef = useRef(false);

  // Keep references updated to bypass stale effects & closure limitations
  const sizeRef = useRef(size);
  const positionRef = useRef(position);

  useEffect(() => {
    sizeRef.current = size;
  }, [size]);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  // Dynamically compute and fit size/position to the active stage bounds
  const fitToScreen = useCallback(() => {
    const s = scale || 1;
    const stageW = Math.max(500, (window.innerWidth / s) - 260); // 260px is modern M3 sidebar width
    const stageH = Math.max(350, (window.innerHeight - 100) / s);

    const defaultW = parseTailwindLength(width, 850);
    const defaultH = parseTailwindLength(height, 550);

    // Keep window size matching default requested size without artificially shrinking it down
    let finalW = Math.min(defaultW, stageW - 20);
    let finalH = Math.min(defaultH, stageH - 20);

    // Constrain sizes to keep layout functional
    const minW = Math.min(380, stageW - 16);
    const minH = Math.min(250, stageH - 16);

    finalW = Math.max(minW, finalW);
    finalH = Math.max(minH, finalH);

    setSize({ width: finalW, height: finalH });

    // Constrain positions so it doesn't leak off screen
    let targetX = initialX;
    let targetY = initialY;

    if (hasManuallyDraggedRef.current) {
      targetX = positionRef.current.x === 0 ? initialX : positionRef.current.x;
      targetY = positionRef.current.y === 0 ? initialY : positionRef.current.y;
    } else {
      // Center window smoothly in the stage if not manually placed
      targetX = Math.max(8, Math.round((stageW - finalW) / 2));
      targetY = Math.max(8, Math.round((stageH - finalH) / 2));
    }

    const fittedX = Math.max(4, Math.min(targetX, stageW - finalW - 4));
    const fittedY = Math.max(4, Math.min(targetY, stageH - finalH - 4));

    setPosition({ x: fittedX, y: fittedY });
  }, [height, initialX, initialY, scale, width]);

  // Handle free window resizing in all 8 directions
  const handleResizeStart = (e: React.PointerEvent, handle: string) => {
    if (e.button !== 0 || isMaximized) return;
    e.stopPropagation();
    e.preventDefault();

    onFocus();
    dragCleanupRef.current?.();

    const startX = e.clientX;
    const startY = e.clientY;
    const startW = sizeRef.current.width;
    const startH = sizeRef.current.height;
    const startPosX = positionRef.current.x;
    const startPosY = positionRef.current.y;
    const s = scale || 1;

    let currentW = startW;
    let currentH = startH;
    let currentX = startPosX;
    let currentY = startPosY;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startX) / s;
      const dy = (moveEvent.clientY - startY) / s;

      const minW = 360;
      const minH = 220;

      if (handle.includes('e')) {
        currentW = Math.max(minW, startW + dx);
      }
      if (handle.includes('s')) {
        currentH = Math.max(minH, startH + dy);
      }
      if (handle.includes('w')) {
        const potentialW = startW - dx;
        if (potentialW >= minW) {
          currentW = potentialW;
          currentX = startPosX + dx;
        }
      }
      if (handle.includes('n')) {
        const potentialH = startH - dy;
        if (potentialH >= minH) {
          currentH = potentialH;
          currentY = startPosY + dy;
        }
      }

      if (windowRef.current) {
        windowRef.current.style.width = `${currentW}px`;
        windowRef.current.style.height = `${currentH}px`;
        windowRef.current.style.left = `${currentX}px`;
        windowRef.current.style.top = `${currentY}px`;
      }

      sizeRef.current = { width: currentW, height: currentH };
      positionRef.current = { x: currentX, y: currentY };
    };

    function removeResizeListeners() {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('pointercancel', handlePointerUp);
      window.removeEventListener('blur', handlePointerUp);
      dragCleanupRef.current = null;
    }

    function handlePointerUp() {
      removeResizeListeners();
      setSize({ width: currentW, height: currentH });
      setPosition({ x: currentX, y: currentY });
      hasManuallyDraggedRef.current = true;
      window.__vbiPerfRecorder?.interaction('window-resized', id);
    }

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('pointercancel', handlePointerUp);
    window.addEventListener('blur', handlePointerUp);
    dragCleanupRef.current = removeResizeListeners;
  };

  // Run on mount, layout props update, or screen size/scale resize
  useEffect(() => {
    fitToScreen();
    window.addEventListener('resize', fitToScreen);
    return () => {
      window.removeEventListener('resize', fitToScreen);
    };
  }, [fitToScreen]);

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only drag with left click on the title bar main area and when not maximized
    if (e.button !== 0 || isMaximized) return;
    
    // Check if clicked target is a button inside title bar
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;

    onFocus();
    dragCleanupRef.current?.();

    const startX = e.clientX;
    const startY = e.clientY;
    const initialPos = { ...positionRef.current };
    const s = scale || 1;

    let currentX = initialPos.x;
    let currentY = initialPos.y;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startX) / s;
      const dy = (moveEvent.clientY - startY) / s;
      
      const stageW = Math.max(500, (window.innerWidth / s) - 260);
      const stageH = Math.max(350, (window.innerHeight - 100) / s);
      
      currentX = Math.max(4, Math.min(stageW - 120, initialPos.x + dx));
      currentY = Math.max(4, Math.min(stageH - 40, initialPos.y + dy));
      
      if (windowRef.current) {
        windowRef.current.style.left = `${currentX}px`;
        windowRef.current.style.top = `${currentY}px`;
      }
      
      positionRef.current = { x: currentX, y: currentY };
    };

    function removeDragListeners() {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('pointercancel', handlePointerUp);
      window.removeEventListener('blur', handlePointerUp);
      dragCleanupRef.current = null;
    }

    function handlePointerUp() {
      removeDragListeners();
      
      // Update React state at the end of the drag session
      setPosition({ x: currentX, y: currentY });
      hasManuallyDraggedRef.current = true;
      window.__vbiPerfRecorder?.interaction('window-moved', id);
    }

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('pointercancel', handlePointerUp);
    window.addEventListener('blur', handlePointerUp);
    dragCleanupRef.current = removeDragListeners;
    
    e.preventDefault();
  };

  const [hasBeenOpened, setHasBeenOpened] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setHasBeenOpened(true);
    }
  }, [isOpen]);

  const isHidden = !isOpen || isMinimized;

  const winStyle: React.CSSProperties = isMaximized
    ? {
        position: 'absolute',
        top: '12px', 
        left: '12px', 
        right: '12px',
        bottom: '12px', 
        zIndex,
        display: isHidden ? 'none' : 'flex',
      }
    : {
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        zIndex,
        display: isHidden ? 'none' : 'flex',
      };

  // Icon selector based on app module
  const getWindowEmoji = (windowId: string) => {
    switch (windowId) {
      case 'welcome': return '📖';
      case 'products': return '📦';
      case 'purchases': return '📥';
      case 'sales': return '📤';
      case 'clients': return '👥';
      case 'stats': return '📊';
      case 'caisse': return '💵';
      case 'situation': return '📕';
      case 'configuration': return '🔧';
      default: return '🧾';
    }
  };

  if (!hasBeenOpened) return null;

  return (
    <div
      ref={windowRef}
      id={`window-${id}`}
      style={winStyle}
      onClick={onFocus}
      className={`
        ${isMaximized ? 'w-auto h-[calc(100vh-124px)]' : ''}
        bg-m3-surface dark:bg-slate-900 rounded-3xl p-2.5
        border border-m3-outline-variant/40 dark:border-slate-800/80 relative flex flex-col font-sans select-none overflow-hidden
        shadow-[0_16px_40px_rgba(40,32,70,0.12),0_4px_12px_rgba(0,0,0,0.05)]
        dark:shadow-[0_24px_64px_rgba(0,0,0,0.6)]
        transition-shadow duration-300
      `}
    >
      {/* Premium subtle gloss highlight */}
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-m3-primary/5 dark:from-sky-700/5 to-transparent pointer-events-none rounded-t-3xl" />

      {/* Title Bar - Google Material 3 Styled */}
      <div
        onPointerDown={handlePointerDown}
        className={`
          h-8 flex items-center justify-between px-2.5 cursor-default relative rounded-xl
          bg-m3-surface-container dark:bg-slate-950/60 text-slate-800 dark:text-slate-100 text-xs font-semibold font-display select-none
          border-b border-m3-outline-variant/10 dark:border-slate-800/40 mb-1
        `}
      >
        <div className="flex items-center gap-1.5 truncate">
          <span className="text-xs shrink-0 select-none bg-m3-primary/10 dark:bg-sky-500/10 w-5.5 h-5.5 rounded-md flex items-center justify-center">
            {getWindowEmoji(id)}
          </span>
          <span className="truncate select-none font-display tracking-tight text-slate-900 dark:text-slate-100 font-bold text-[11px] sm:text-xs">
            {title}
          </span>
        </div>
        
        {/* Material 3 Styled window controls */}
        <div className="flex items-center gap-1 select-none shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onMinimize(); }}
            id={`btn-close-${id}`}
            title="Réduire"
            className="w-5.5 h-5.5 rounded-full flex items-center justify-center bg-rose-50 hover:bg-rose-500 hover:text-white dark:bg-rose-950/20 text-rose-600 dark:hover:bg-rose-600 transition-all cursor-pointer font-bold"
          >
            <X size={10} className="stroke-[3]" />
          </button>
        </div>
      </div>

      {/* Material 3 Client Area with rounded margins */}
      <div className={`flex-1 min-h-0 bg-m3-surface-container/30 dark:bg-slate-950/30 p-2 flex flex-col relative rounded-2xl border border-m3-outline-variant/10 dark:border-slate-800/30 ${overflowVisible ? 'overflow-visible' : 'overflow-auto'}`}>
        {children}
      </div>

      {/* 8-Direction Free Mouse Resize Handles */}
      {!isMaximized && (
        <>
          {/* Edges */}
          <div onPointerDown={(e) => handleResizeStart(e, 'n')} className="absolute top-0 left-4 right-4 h-2.5 cursor-ns-resize z-[100]" title="Redimensionner" />
          <div onPointerDown={(e) => handleResizeStart(e, 's')} className="absolute bottom-0 left-4 right-4 h-2.5 cursor-ns-resize z-[100]" title="Redimensionner" />
          <div onPointerDown={(e) => handleResizeStart(e, 'w')} className="absolute top-4 bottom-4 left-0 w-2.5 cursor-ew-resize z-[100]" title="Redimensionner" />
          <div onPointerDown={(e) => handleResizeStart(e, 'e')} className="absolute top-4 bottom-4 right-0 w-2.5 cursor-ew-resize z-[100]" title="Redimensionner" />

          {/* Corners */}
          <div onPointerDown={(e) => handleResizeStart(e, 'nw')} className="absolute top-0 left-0 w-4 h-4 cursor-nwse-resize z-[101]" title="Redimensionner" />
          <div onPointerDown={(e) => handleResizeStart(e, 'ne')} className="absolute top-0 right-0 w-4 h-4 cursor-nesw-resize z-[101]" title="Redimensionner" />
          <div onPointerDown={(e) => handleResizeStart(e, 'sw')} className="absolute bottom-0 left-0 w-4 h-4 cursor-nesw-resize z-[101]" title="Redimensionner" />
          
          {/* Bottom Right Corner with visual grip indicator */}
          <div
            onPointerDown={(e) => handleResizeStart(e, 'se')}
            className="absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize z-[101] flex items-center justify-center group"
            title="Redimensionner librement avec la souris"
          >
            <div className="w-2.5 h-2.5 border-r-2 border-b-2 border-slate-400 dark:border-slate-500 rounded-br group-hover:border-sky-500 dark:group-hover:border-sky-400 transition-colors" />
          </div>
        </>
      )}
    </div>
  );
}
