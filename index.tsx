import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Define pdfjsLib on the window object for TypeScript since it's loaded from a script tag
declare global {
    interface Window {
      pdfjsLib: any;
    }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);