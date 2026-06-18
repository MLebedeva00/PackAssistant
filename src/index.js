import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

// Находим контейнер в index.html
const root = ReactDOM.createRoot(document.getElementById('root'));

// Отрисовываем внутри него наше приложение
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>    
  </React.StrictMode>
);