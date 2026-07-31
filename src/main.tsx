import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global handler to prevent mouse wheel from changing input[type="number"] values
document.addEventListener(
  'wheel',
  (e: WheelEvent) => {
    const activeEl = document.activeElement as HTMLElement | null;
    const targetEl = e.target as HTMLElement | null;
    if (
      (activeEl && activeEl.tagName === 'INPUT' && (activeEl as HTMLInputElement).type === 'number') ||
      (targetEl && targetEl.tagName === 'INPUT' && (targetEl as HTMLInputElement).type === 'number')
    ) {
      if (activeEl && activeEl.tagName === 'INPUT') {
        (activeEl as HTMLInputElement).blur();
      }
      e.preventDefault();
    }
  },
  { passive: false }
);

function renderApplication() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

if (window.vbiPerf?.enabled) {
  void import('./services/perfDiagnostics')
    .then(({installPerformanceDiagnostics}) => {
      installPerformanceDiagnostics();
      window.__vbiPerfRecorder?.timing(
        'renderer.bootstrap',
        performance.now(),
        {measurement: 'navigation-start-to-react-render-call'},
      );
      renderApplication();
    })
    .catch((error) => {
      console.error(
        '[VBI PERF] Diagnostic bootstrap failed; continuing without renderer diagnostics.',
        error instanceof Error ? error.message : String(error),
      );
      renderApplication();
    });
} else {
  renderApplication();
}

