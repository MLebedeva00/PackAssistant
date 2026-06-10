import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Находим контейнер в index.html
const root = ReactDOM.createRoot(document.getElementById('root'));

// Отрисовываем внутри него наше приложение
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);