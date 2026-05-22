import React, { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';

import FileUploader from './components/FileUploader';
import ChatInterface from './components/ChatInterface';
import { processExcelFile } from './utils/dataProcessor';
import { generateDummyData } from './utils/dummyGenerator';

import './styles/index.css';
import './styles/glass.css';
import './styles/retro.css';

function App() {
  const [rawData, setRawData] = useState(null);
  const [topHeight, setTopHeight] = useState(250); // Default height in pixels
  const [isTopMinimized, setIsTopMinimized] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  
  const containerRef = useRef(null);
  const isDragging = useRef(false);
  const currency = 'JPY';

  // Digital clock effect (AM/PM)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'
      setCurrentTime(`${hours}:${minutes} ${ampm}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleFileUpload = async (file) => {
    const data = await processExcelFile(file);
    setRawData(data);
  };

  const handleUseDemo = () => {
    const data = generateDummyData();
    setRawData(data);
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    isDragging.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newHeight = e.clientY - containerRect.top;
    
    // Constrain height between 80px and total height - 150px
    const minHeight = 80;
    const maxHeight = containerRect.height - 150;
    
    if (newHeight >= minHeight && newHeight <= maxHeight) {
      setTopHeight(newHeight);
    }
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!rawData) {
    return (
      <div className="retro-bg flex items-center justify-center min-h-screen">
        <FileUploader onFileUpload={handleFileUpload} onUseDemo={handleUseDemo} />
      </div>
    );
  }

  // Take the first 10 rows for display
  const displayData = rawData.slice(0, 10);

  return (
    <div className="retro-bg flex flex-col justify-between min-h-screen p-0" style={{ paddingBottom: '32px' }}>
      <div ref={containerRef} className="max-w-6xl mx-auto flex flex-col h-[calc(100vh-32px-40px)] w-full p-4 flex-1">

        {/* Top Window: Data Preview */}
        <div 
          className="retro-window flex-shrink-0 flex flex-col" 
          style={{ 
            height: isTopMinimized ? 0 : `${topHeight}px`, 
            display: isTopMinimized ? 'none' : 'flex' 
          }}
        >
          <div className="retro-titlebar">
            <span>Microsoft Excel - Data.xls</span>
            <div className="retro-titlebar-buttons">
              <div className="retro-titlebar-button" onClick={() => setIsTopMinimized(true)}>_</div>
              <div className="retro-titlebar-button" onClick={() => setIsTopMinimized(true)}>□</div>
              <div className="retro-titlebar-button" onClick={() => setRawData(null)}>X</div>
            </div>
          </div>

          <div className="retro-content flex-1 h-[calc(100%-25px)] flex flex-col min-h-0">
            <div className="mb-2 flex items-center gap-2 flex-shrink-0">
              <button className="retro-button" onClick={() => setRawData(null)}>
                New File
              </button>
              <span className="text-[13px] ml-4 text-gray-700">Previewing first {displayData.length} of {rawData.length} rows</span>
            </div>

            <div className="retro-panel flex-1 retro-scrollbar">
              <table className="retro-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Remarks</th>
                    <th>Category</th>
                    <th>Expense</th>
                    <th>Onetime</th>
                    <th>For Others</th>
                  </tr>
                </thead>
                <tbody>
                  {displayData.map((row, i) => (
                    <tr key={i}>
                      <td>{format(row.Date, 'yyyy-MM-dd')}</td>
                      <td>{row.remarks || ''}</td>
                      <td>{row.NewCategory || row.Category || ''}</td>
                      <td className="text-right">{(row.Expense || 0).toLocaleString()} {currency}</td>
                      <td>{row.Onetime ? 'Yes' : 'No'}</td>
                      <td>{row['for others'] ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Draggable Divider */}
        {!isTopMinimized && (
          <div className="retro-divider" onMouseDown={handleMouseDown} />
        )}

        {/* Bottom Window: Chat/LLM Interface */}
        <div className="retro-window flex-1 flex flex-col min-h-0">
          <div className="retro-titlebar">
            <span>Q&A Assistant</span>
            <div className="retro-titlebar-buttons">
              <div className="retro-titlebar-button">_</div>
              <div className="retro-titlebar-button">□</div>
              <div className="retro-titlebar-button">X</div>
            </div>
          </div>

          <div className="retro-content flex-1 h-[calc(100%-25px)] p-0 min-h-0">
            {/* Inline chat interface instead of overlay */}
            <ChatInterface
              data={rawData}
              currency={currency}
              visible={true}
              onClose={() => { }}
            />
          </div>
        </div>
      </div>

      {/* Windows 95 Taskbar */}
      <div className="retro-taskbar">
        <button className="retro-start-button">
          <span className="text-[13px] font-bold">Start</span>
        </button>
        <div className="retro-taskbar-divider" />
        <div className="retro-taskbar-windows">
          <button 
            className={`retro-taskbar-item ${isTopMinimized ? 'minimized' : 'active'}`}
            onClick={() => setIsTopMinimized(!isTopMinimized)}
          >
            <span>📊 Microsoft Excel - Data.xls</span>
          </button>
          <button className="retro-taskbar-item active">
            <span>💬 Q&A Assistant</span>
          </button>
        </div>
        <div className="retro-taskbar-clock">
          <span>{currentTime}</span>
        </div>
      </div>
    </div>
  );
}

export default App;
