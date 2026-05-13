import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/responsive-global.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { ThemeProvider } from './context/ThemeContext.tsx'

// Clamp negative SVG rect height/width during spring animation overshoot (sileo library)
const _setAttribute = SVGElement.prototype.setAttribute;
SVGElement.prototype.setAttribute = function(name: string, value: string) {
  if ((name === 'height' || name === 'width') && this.tagName === 'rect') {
    const n = parseFloat(value);
    if (!isNaN(n) && n < 0) return;
  }
  _setAttribute.call(this, name, value);
};

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <ThemeProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </ThemeProvider>
    </StrictMode>,
  )
}

// PWA: registrar Service Worker (solo en producción / build)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* silent */ });
  });
}

