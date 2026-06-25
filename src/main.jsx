import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './input.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Service Worker unregister karein aur Caches clear karein taaki humesha fresh data load ho
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (let registration of registrations) {
      registration.unregister().then((success) => {
        if (success) console.log('Service Worker unregistered successfully.');
      });
    }
  }).catch((err) => {
    console.error('Error getting SW registrations:', err);
  });
}

if ('caches' in window) {
  caches.keys().then((keys) => {
    return Promise.all(keys.map(key => caches.delete(key)));
  }).then(() => {
    console.log('All caches cleared.');
  }).catch((err) => {
    console.error('Error clearing caches:', err);
  });
}

