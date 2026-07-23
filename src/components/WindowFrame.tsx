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

    const defaultW = parseTailwindLength(width, 800);
    const defaultH = parseTailwindLength(height, 500);

    // Calculate scaled window size based on stage size compared to standard baseline (1185 x 700)
    // This allows the windows to scale up when screen is larger, and scale down when smaller,
    // keeping everything in perfect proportion and avoiding layout breakages!
    let finalW = Math.round(stageW * (defaultW / 1185));
    let finalH = Math.round(stageH * (defaultH / 700));

    // Constrain sizes to keep layout functional
    const minW = Math.min(420, stageW - 16);
    const minH = Math.min(260, stageH - 16);
    const maxW = stageW - 16;
    const maxH = stageH - 16;

    finalW = Math.max(minW, Math.min(maxW, finalW));
    finalH = Math.max(minH, Math.min(maxH, finalH));

    setSize({ width: finalW, height: finalH });

    // Constrain positions so it doesn't leak off screen
    let targetX = initialX;
    let targetY = initialY;

    if (hasManuallyDraggedRef.current) {
      targetX = positionRef.current.x === 0 ? initialX : positionRef.current.x;
      targetY = positionRef.current.y === 0 ? initialY : positionRef.current.y;
    } else {
      // Scale initial coordinates proportionally to current stage size from baseline (1185 x 700)
      targetX = Math.round(stageW * (initialX / 1185));
      targetY = Math.round(stageH * (initialY / 700));
    }

    const fittedX = Math.max(8, Math.min(targetX, stageW - finalW - 8));
    const fittedY = Math.max(8, Math.min(targetY, stageH - finalH - 8));

    setPosition({ x: fittedX, y: fittedY });
  }, [height, initialX, initialY, scale, width]);

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

    </div>
  );
}
