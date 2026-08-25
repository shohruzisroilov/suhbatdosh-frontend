import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';

try {
  if (window.Telegram?.WebApp) {
    window.Telegram.WebApp.ready();
    window.Telegram.WebApp.expand();
  }
} catch (e) {
  console.warn('Telegram WebApp not available:', e);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
