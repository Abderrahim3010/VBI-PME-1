import React, { useState, useEffect, useRef } from 'react';
import { Minus, Square, X, Minimize2, Move, Layers } from 'lucide-react';

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
  scale = 1
}: WindowFrameProps) {
  const [position, setPosition] = useState({ x: initialX, y: initialY });
  const windowRef = useRef<HTMLDivElement>(null);

  // High performance sizing state
  const [size, setSize] = useState(() => {
    const defaultW = parseTailwindLength(width, 800);
    const defaultH = parseTailwindLength(height, 500);
    return { width: defaultW, height: defaultH };
  });

  const hasManuallyResizedRef = useRef(false);

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
  const fitToScreen = () => {
    const s = scale || 1;
    const stageW = Math.max(500, (window.innerWidth / s) - 260); // 260px is modern M3 sidebar width
    const stageH = Math.max(350, (window.innerHeight - 100) / s);

    const defaultW = parseTailwindLength(width, 800);
    const defaultH = parseTailwindLength(height, 500);

    // Limit window sizes to match available desktop stage with padding
    const fittedW = Math.min(defaultW, stageW - 16);
    const fittedH = Math.min(defaultH, stageH - 16);

    let finalW = fittedW;
    let finalH = fittedH;

    if (hasManuallyResizedRef.current) {
      finalW = Math.min(sizeRef.current.width, stageW - 16);
      finalH = Math.min(sizeRef.current.height, stageH - 16);
    }

    setSize({ width: finalW, height: finalH });

    // Constrain positions so it doesn't leak off screen
    const currentX = positionRef.current.x === 0 ? initialX : positionRef.current.x;
    const currentY = positionRef.current.y === 0 ? initialY : positionRef.current.y;

    const fittedX = Math.max(8, Math.min(currentX, stageW - finalW - 8));
    const fittedY = Math.max(8, Math.min(currentY, stageH - finalH - 8));

    setPosition({ x: fittedX, y: fittedY });
  };

  // Run on mount, layout props update, or screen size/scale resize
  useEffect(() => {
    fitToScreen();
    window.addEventListener('resize', fitToScreen);
    return () => {
      window.removeEventListener('resize', fitToScreen);
    };
  }, [width, height, initialX, initialY, scale]);

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only drag with left click on the title bar main area and when not maximized
    if (e.button !== 0 || isMaximized) return;
    
    // Check if clicked target is a button inside title bar
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;

    onFocus();

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

    const handlePointerUp = () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      
      // Update React state at the end of the drag session
      setPosition({ x: currentX, y: currentY });
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    
    e.preventDefault();
  };

  const handleResizeStart = (e: React.PointerEvent) => {
    if (e.button !== 0 || isMaximized) return;
    onFocus();

    const startX = e.clientX;
    const startY = e.clientY;
    const startW = sizeRef.current.width;
    const startH = sizeRef.current.height;
    const s = scale || 1;

    let currentWidth = startW;
    let currentHeight = startH;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startX) / s;
      const dy = (moveEvent.clientY - startY) / s;
      
      const stageW = Math.max(500, (window.innerWidth / s) - 260);
      const stageH = Math.max(350, (window.innerHeight - 100) / s);

      const maxW = stageW - positionRef.current.x - 8;
      const maxH = stageH - positionRef.current.y - 8;
      
      currentWidth = Math.max(380, Math.min(maxW, startW + dx));
      currentHeight = Math.max(220, Math.min(maxH, startH + dy));
      
      if (windowRef.current) {
        windowRef.current.style.width = `${currentWidth}px`;
        windowRef.current.style.height = `${currentHeight}px`;
      }
      
      sizeRef.current = { width: currentWidth, height: currentHeight };
    };

    const handlePointerUp = () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      
      // Update React state at the end of the resize session
      setSize({ width: currentWidth, height: currentHeight });
      hasManuallyResizedRef.current = true;
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    
    e.preventDefault();
    e.stopPropagation();
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
      <div className="flex-1 min-h-0 bg-m3-surface-container/30 dark:bg-slate-950/30 p-2 flex flex-col relative rounded-2xl border border-m3-outline-variant/10 dark:border-slate-800/30 overflow-auto">
        {children}
      </div>

      {/* Dynamic Resize Handle at the bottom right corner */}
      {!isMaximized && (
        <div
          onPointerDown={handleResizeStart}
          className="absolute bottom-1 right-1 w-8 h-8 cursor-se-resize z-[100] flex items-end justify-end p-1.5 select-none hover:bg-slate-100 dark:hover:bg-slate-800 rounded-br-2xl text-slate-400 hover:text-indigo-500 transition-colors"
          title="Faites glisser pour redimensionner"
        >
          <Move size={12} className="rotate-45 select-none pointer-events-none" />
        </div>
      )}
    </div>
  );
}
