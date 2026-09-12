import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles/tokens.css';
import './styles/global.css';
import './styles/app.css';
import './styles/screens.css';
import './styles/lab.css';
import './styles/overlays.css';
import './styles/lab-polish.css';
import './styles/home.css';
import './styles/crt.css';
import './styles/crt-refinements.css';

const host = document.getElementById('root');
if (!host) throw new Error('MODBOX could not find #root');

createRoot(host).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
