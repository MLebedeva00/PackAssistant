import React, { useState, useEffect, useRef } from 'react';
import { createAssistant, createSmartappDebugger } from '@salutejs/client';
import './App.css';

// Инициализация ассистента (с поддержкой дебаггера для локальной разработки)
const initializeAssistant = (getState) => {
  if (process.env.NODE_ENV === 'development') {
    return createSmartappDebugger({
      token: process.env.REACT_APP_TOKEN || "",
      initPhrase: `запусти ${process.env.REACT_APP_SMARTAPP}`,
      getState,
      nativePanel: {
        defaultText: 'Я тебя слушаю!',
        screenshotMode: false,
        tabIndex: -1,
      },
    });
  }
  return createAssistant({ getState });
};

function App() {
  const [currentScreen, setCurrentScreen] = useState('welcome'); // 'welcome' или 'checklist'
  const [listTitle, setListTitle] = useState('');
  const [items, setItems] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  
  const assistantRef = useRef(null);

  useEffect(() => {
    assistantRef.current = initializeAssistant(() => ({}));
    
    // Слушаем команды (smart_app_data) от сценария бэкенда
    assistantRef.current.on('data', (event) => {
      if (event.type === 'smart_app_data' && event.action) {
        const { type, listType, items: backendItems, index, status } = event.action;
        
        switch (type) {
          case 'INIT_APP':
            setCurrentScreen('welcome');
            setItems([]);
            break;
            
          case 'SET_CHECKLIST':
            const titles = { sea: '🏖️ На море', mountains: '🏔️ В горы', business: '💼 Командировка' };
            setListTitle(titles[listType] || '🎒 Чеклист');
            setItems(backendItems.map(name => ({ name, status: 'pending' }))); // pending, completed, skipped
            setActiveIndex(0);
            setCurrentScreen('checklist');
            break;
            
          case 'UPDATE_ITEM_STATUS':
            setItems(prev => prev.map((item, idx) => idx === index ? { ...item, status } : item));
            setActiveIndex(index + 1);
            break;
            
          default:
            break;
        }
      }
    });
  }, []);

  
  const handleGoHome = (phrase) => {
    assistantRef.current?.sendData({
      action: { action_id: 'GO_HOME', server_action: { intent: phrase } }
    });
  };


  const handleCategoryClick = (categoryName) => {
    if (assistantRef.current) {
      
      let actionId = 'CLICK_BUSINESS';
      if (categoryName === 'На море') actionId = 'CLICK_SEA';
      if (categoryName === 'В горы') actionId = 'CLICK_MOUNTAINS';

      assistantRef.current.sendData({
        action: { 
          action_id: actionId, 
          server_action: {} 
        }
      });
    }
  };
  
  const handleChecklistAction = (commandText) => {
    if (assistantRef.current) {
      
      // Определяем правильное имя события в зависимости от нажатой кнопки
      let actionId = 'CHECKLIST_COMMAND';
      if (commandText === "Да") actionId = 'CLICK_YES';
      if (commandText === "Пропусти") actionId = 'CLICK_SKIP';

      assistantRef.current.sendData({
        action: { 
          action_id: actionId, 
          server_action: {} 
        }
      });
    }
  };


  return (
    <div className="app-container">
      <header className="app-header">
        <h1 
          onClick={() => handleGoHome("На главную")}
          style={{ cursor: 'pointer' }}
          title="Вернуться на главную"
        >
          PackAssistant
        </h1>
        <div className="status-indicator">Голосовой ассистент активен</div>
      </header>

      <main className="app-main">
        {currentScreen === 'welcome' ? (
          <div className="welcome-screen">
            <p className="subtitle">Куда держим путь?</p>
            <div className="menu-grid">
              <button className="menu-card sea" onClick={() => handleCategoryClick("На море")}>
                <span className="card-icon">🏖️</span>
                <h3>На море</h3>
                <p>Плавки, крем, очки и пляжное настроение</p>
              </button>
              <button className="menu-card mountains" onClick={() => handleCategoryClick("В горы")}>
                <span className="card-icon">🏔️</span>
                <h3>В горы</h3>
                <p>Ботинки, дождевик, фонарь и дух приключений</p>
              </button>
              <button className="menu-card business" onClick={() => handleCategoryClick("Командировка")}>
                <span className="card-icon">💼</span>
                <h3>Командировка</h3>
                <p>Ноутбук, строгий костюм и зарядные устройства</p>
              </button>
            </div>
          </div>
        ) : (
          <div className="checklist-screen">
            
            <h2 className="checklist-title">{listTitle}</h2>
            <div className="checklist-box">
              {items.map((item, idx) => {
                let itemClass = "checklist-item";
                if (idx === activeIndex) itemClass += " active";
                if (item.status === 'completed') itemClass += " completed";
                if (item.status === 'skipped') itemClass += " skipped";                

                return (
                  <div key={idx} className={itemClass} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0' }}>
                    {/* Обновленный квадратик-чекбокс */}
                    <div 
                      className="item-checkbox"
                      style={{
                        width: '24px', 
                        height: '24px', 
                        border: item.status === 'completed' ? '2px solid #10b981' : '2px solid #ccc', 
                        borderRadius: '6px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        cursor: idx === activeIndex ? 'pointer' : 'default',
                        backgroundColor: item.status === 'completed' ? '#10b981' : 'transparent',
                        color: 'white',
                        fontWeight: 'bold',
                        transition: 'all 0.2s',
                        flexShrink: 0
                      }}
                      onClick={() => {
                        // Защита: разрешаем кликать только по текущему пункту
                        if (idx === activeIndex) {
                          handleChecklistAction("Да");
                        }
                      }}
                    >
                      {item.status === 'completed' && '✓'}
                      {item.status === 'skipped' && '➔'}
                    </div>
                    {/* Конец обновленного квадратика */}

                    <span className="item-text" style={{ flexGrow: 1 }}>{item.name}</span>
                    
                    {/* Блок управления для активного пункта: бейдж и кнопка пропуска */}
                    {idx === activeIndex && (
                      <div className="active-item-controls" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className="voice-badge">Ассистент спрашивает...</span>
                        
                        <button 
                          className="skip-button"
                          onClick={() => handleChecklistAction("Пропусти")}
                          style={{ 
                            padding: '6px 12px', 
                            fontSize: '12px',
                            backgroundColor: '#ff9800', 
                            border: 'none',             
                            borderRadius: '6px',
                            cursor: 'pointer',
                            color: 'white',            
                            fontWeight: 'bold',         
                            transition: 'background-color 0.2s'
                          }}
                        >
                          Отложить
                        </button>
                      </div>
                    )}
                  </div>
                );

              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;