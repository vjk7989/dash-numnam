import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ProductionApp } from './ProductionApp';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProductionApp />
  </StrictMode>,
);
