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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

