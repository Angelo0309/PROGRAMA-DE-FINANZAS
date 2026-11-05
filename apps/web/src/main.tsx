import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app';

const root = document.getElementById('root');

if (!root) {
  throw new Error('No se encontro el contenedor principal de CrediCuenta');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

