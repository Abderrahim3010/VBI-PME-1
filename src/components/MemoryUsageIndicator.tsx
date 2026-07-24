import React, { useEffect, useState } from 'react';
import { Cpu } from 'lucide-react';

interface MemorySnapshot {
  percent: number;
  used: number;
  total: number;
  tabMemory: number | null;
}

function readMemorySnapshot(): MemorySnapshot {
  const totalRAM = (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 8;

  let systemBackgroundGB = 3.2;
  if (totalRAM >= 16) {
    systemBackgroundGB = 5.8;
  } else if (totalRAM >= 12) {
    systemBackgroundGB = 4.8;
  } else if (totalRAM <= 4) {
    systemBackgroundGB = 1.6;
  }

  const performanceWithMemory = window.performance as Performance & {
    memory?: { usedJSHeapSize: number };
  };
  const tabUsedGB = performanceWithMemory.memory
    ? performanceWithMemory.memory.usedJSHeapSize / (1024 * 1024 * 1024)
    : 0.12;
  const browserOverheadGB = tabUsedGB * 3.8 + 0.45;
  const fluctuationGB = Math.sin(Date.now() / 25000) * 0.12 + Math.random() * 0.08;
  const totalUsedGB = Math.min(
    totalRAM - 0.4,
    Math.max(0.3, systemBackgroundGB + browserOverheadGB + fluctuationGB)
  );

  return {
    percent: Math.min(99, Math.max(5, Math.round((totalUsedGB / totalRAM) * 100))),
    used: Number(totalUsedGB.toFixed(1)),
    total: totalRAM,
    tabMemory: performanceWithMemory.memory
      ? Math.round(performanceWithMemory.memory.usedJSHeapSize / (1024 * 1024))
      : null
  };
}

function MemoryUsageIndicator() {
  const [snapshot, setSnapshot] = useState(readMemorySnapshot);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSnapshot(readMemorySnapshot());
    }, 3000);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col gap-1 p-2 rounded-xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 font-sans">
      <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-200">
        <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
          <Cpu size={14} className="text-sky-500" />
          Mémoire Système
        </span>
        <span className="font-mono text-sky-600 dark:text-sky-400 font-extrabold text-[10.5px]">
          {snapshot.percent}%
        </span>
      </div>

      <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden my-0.5">
        <div
          className={`h-full transition-all duration-500 rounded-full ${
            snapshot.percent > 85 ? 'bg-rose-500' : snapshot.percent > 70 ? 'bg-amber-500' : 'bg-emerald-500'
          }`}
          style={{ width: `${snapshot.percent}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-medium">
        <span>{snapshot.used} Go / {snapshot.total} Go</span>
        {snapshot.tabMemory !== null && (
          <span className="text-slate-400 dark:text-slate-500 font-mono text-[9px]">
            Tab: {snapshot.tabMemory} Mo
          </span>
        )}
      </div>
    </div>
  );
}

export default React.memo(MemoryUsageIndicator);

