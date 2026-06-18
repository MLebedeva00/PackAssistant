import React, { useState, useEffect, useRef } from 'react';
import { createAssistant, createSmartappDebugger } from '@salutejs/client';
import { Routes, Route, useNavigate } from 'react-router-dom';
import './App.css';

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
  const navigate = useNavigate();
  const [listTitle, setListTitle] = useState('');
  const [items, setItems] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [currentListType, setCurrentListType] = useState(null); 
  const [isFirstPassCompleted, setIsFirstPassCompleted] = useState(false);
  const assistantRef = useRef(null);

  useEffect(() => {
    localStorage.removeItem('packAssistant_sea');
    localStorage.removeItem('packAssistant_mountains');
    localStorage.removeItem('packAssistant_business');
  }, []);

  // Автоматическая фиксация завершения первого прохождения
  useEffect(() => {
    if (items.length > 0 && activeIndex >= items.length) {
      setIsFirstPassCompleted(true);
    }
  }, [activeIndex, items.length]);

  // Сохранение в localStorage (включая флаг завершения)
  useEffect(() => {
    if (currentListType && items.length > 0) {
      localStorage.setItem(`packAssistant_${currentListType}`, JSON.stringify({
        savedItems: items,
        savedActiveIndex: activeIndex,
        savedFirstPassCompleted: isFirstPassCompleted
      }));
    }
  }, [items, activeIndex, currentListType, isFirstPassCompleted]);

  useEffect(() => {
    assistantRef.current = initializeAssistant(() => ({}));
    
    assistantRef.current.on('data', (event) => {
      if (event.type === 'smart_app_data' && event.action) {
        const { type, listType, items: backendItems, index, status } = event.action;
        
        switch (type) {
          case 'INIT_APP':
            navigate('/');
            setItems([]);
            setListTitle('');
            setActiveIndex(0);
            setCurrentListType(null);
            setIsFirstPassCompleted(false);
            break;
            
          case 'SET_CHECKLIST':
            const titles = { sea: '🏖️ На море', mountains: '🏔️ В горы', business: '💼 Командировка' };
            setListTitle(titles[listType] || '🎒 Чеклист');
            setCurrentListType(listType);

            const savedData = localStorage.getItem(`packAssistant_${listType}`);
            if (savedData) {
              const { savedItems, savedActiveIndex, savedFirstPassCompleted } = JSON.parse(savedData);
              setItems(savedItems);

              const isAllPending = savedItems.every(item => item.status === 'pending' || !item.status);
              
              setActiveIndex(isAllPending ? 0 : savedActiveIndex);
              setIsFirstPassCompleted(isAllPending ? false : (savedFirstPassCompleted || false));
            } else {
              setItems(backendItems.map(name => ({ name, status: 'pending' })));
              setActiveIndex(0);
              setIsFirstPassCompleted(false);
            }
            
            navigate(`/checklist/${listType}`);
            break;
            
          case 'UPDATE_ITEM_STATUS':
            setItems(prev => prev.map((item, idx) => idx === index ? { ...item, status } : item));
            setActiveIndex(index + 1);
            break;

          case 'RESET_CHECKLIST':            
            localStorage.removeItem(`packAssistant_${listType}`);
            const resetTitles = { sea: '🏖️ На море', mountains: '🏔️ В горы', business: '💼 Командировка' };
            setListTitle(resetTitles[listType] || '🎒 Чеклист');
            setCurrentListType(listType);            
          
            setItems(backendItems.map(name => ({ name, status: 'pending' })));
            setActiveIndex(0);
            setIsFirstPassCompleted(false);
            
            navigate(`/checklist/${listType}`);
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
        action: { action_id: actionId, server_action: {} }
      });
    }
  };
  
  const handleChecklistAction = (commandText) => {
    if (assistantRef.current) {
      let actionId = 'CHECKLIST_COMMAND';
      if (commandText === "Да") actionId = 'CLICK_YES';
      if (commandText === "Пропусти") actionId = 'CLICK_SKIP';
      assistantRef.current.sendData({
        action: { action_id: actionId, server_action: {} }
      });
    }
  };

  const handleCheckboxClick = (idx) => {
    const isCompleted = items[idx].status === 'completed';

    if (isCompleted) {
      setItems(prevItems => prevItems.map((item, i) =>
        i === idx ? { ...item, status: 'pending' } : item
      ));

      // ТЕПЕРЬ ВСЕГДА переводим фокус на этот элемент, чтобы появились кнопки управления
      setActiveIndex(idx);

    } else {
      // Ставим галочку

      setItems(prevItems => prevItems.map((item, i) =>
        i === idx ? { ...item, status: 'completed' } : item
      ));
     

      if (!isFirstPassCompleted && idx === activeIndex) {
        setActiveIndex(idx + 1);
        handleChecklistAction("Да");

      } else if (isFirstPassCompleted && idx === activeIndex) {

        setActiveIndex(idx + 1);

      }

    }

  };

  const handleSkipClick = (idx) => {
    setItems(prevItems => prevItems.map((item, i) => 
      i === idx ? { ...item, status: 'skipped' } : item
    ));
    setActiveIndex(idx + 1);    
    handleChecklistAction("Пропусти");
  };

  const handleRestartApp = () => {
    if (currentListType) {
      localStorage.removeItem(`packAssistant_${currentListType}`);
      setItems(prevItems => prevItems.map(item => ({ ...item, status: 'pending' })));
      setActiveIndex(0);
      setIsFirstPassCompleted(false);
    }

    if (assistantRef.current) {
      assistantRef.current.sendData({
        action: { 
          action_id: 'CLICK_RESTART', 
          server_action: { intent: 'начни заново' } 
        }
      });
    }
  };

  // Блокировка работает на основе независимого флага состояния
  const isLockedForIndex = (idx) => !isFirstPassCompleted && idx !== activeIndex;

  return (
    <div className="app-container">
      <header className="app-header">
        <h1 
          onClick={() => {
            handleGoHome("На главную");
            navigate('/');
          }}
          style={{ cursor: 'pointer' }}
          title="Вернуться на главную"
        >
          PackAssistant
        </h1>
        <div className="status-indicator">Голосовой ассистент активен</div>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={
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
          } />

          <Route path="/checklist/:type" element={
            <div className="checklist-screen">            
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 className="checklist-title" style={{ margin: 0 }}>{listTitle}</h2>
                <button 
                  onClick={handleRestartApp}
                  style={{ fontSize: '14px', padding: '8px 16px', borderRadius: '10px', border: 'none', background: '#633a34', color: 'white', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.2s' }}
                >
                  Начать заново
                </button>
              </div>
              <div className="checklist-box">
                {items.map((item, idx) => {
                  const isLocked = isLockedForIndex(idx);
                  let itemClass = "checklist-item";
                  if (idx === activeIndex) itemClass += " active";
                  if (item.status === 'completed') itemClass += " completed";
                  if (item.status === 'skipped') itemClass += " skipped";
                  if (isLocked) itemClass += " locked";

                  return (
                    <div key={idx} className={itemClass} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', opacity: isLocked ? 0.5 : 1, pointerEvents: isLocked ? 'none' : 'auto' }}>
                      
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
                          cursor: 'pointer',
                          backgroundColor: item.status === 'completed' ? '#10b981' : 'transparent',
                          color: 'white',
                          fontWeight: 'bold',
                          transition: 'all 0.2s',
                          flexShrink: 0
                        }}
                        onClick={() => handleCheckboxClick(idx)}
                      >
                        {item.status === 'completed' && '✓'}
                        {item.status === 'skipped' && '➔'}
                      </div>
                      
                      <span className="item-text" style={{ flexGrow: 1 }}>{item.name}</span>
                      
                      {/* Условие изменено: показываем панель управления только если индекс совпадает И пункт не завершен */}
                      {idx === activeIndex && item.status !== 'completed' && (
                        <div className="active-item-controls" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span className="voice-badge">Ассистент спрашивает...</span>
                          <button 
                            className="skip-button"
                            onClick={() => handleSkipClick(idx)}
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
          } />
        </Routes>
      </main>
    </div>
  );
}

export default App;