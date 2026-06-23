import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './input.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register Service Worker for PWA (auto-update: naya deploy apne aap load hoga)
/* global __SW_VERSION__ */
if ('serviceWorker' in navigator) {
  // Jaise hi naya service worker control le, page ko ek baar auto-reload karo.
  // 'refreshing' guard reload-loop se bachata hai.
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    // __SW_VERSION__ har build par badalta hai -> browser ko hamesha
    // naya service worker milta hai -> purana cache delete + naya code load.
    navigator.serviceWorker.register(`sw.js?v=${__SW_VERSION__}`)
      .then(reg => {
        console.log('Service Worker registered:', reg.scope);
        // Har page load par update check karo
        reg.update();
        reg.onupdatefound = () => {
          const installingWorker = reg.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              // Naya SW install hua aur pehle se ek SW control me hai => update available.
              // SW ke install event me skipWaiting() hai, isliye wo turant active hoga
              // aur upar wala 'controllerchange' page ko reload kar dega.
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('New version installed — activating & reloading...');
              }
            };
          }
        };
      })
      .catch(err => console.log('Service Worker registration failed:', err));
  });
}
