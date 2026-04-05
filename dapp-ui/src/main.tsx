import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

// Patch fetch for Proof Server compatibility:
// The SDK sends body as ArrayBuffer via `payload.buffer`, but polyfilled
// Buffer's .buffer can return a shared/offset ArrayBuffer that corrupts
// the binary data. This wrapper ensures the body is sent as a proper Uint8Array.
const originalFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  if (init?.body instanceof ArrayBuffer) {
    init = { ...init, body: new Uint8Array(init.body) };
  }
  return originalFetch(input, init);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
