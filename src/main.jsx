import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './input.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js?v=57')
      .then(reg => {
        console.log('Service Worker registered successfully:', reg.scope);
        reg.onupdatefound = () => {
          const installingWorker = reg.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  console.log('New update installed, reloading page...');
                  window.location.reload();
                }
              }
            };
          }
        };
      })
      .catch(err => console.log('Service Worker registration failed:', err));
  });
}
