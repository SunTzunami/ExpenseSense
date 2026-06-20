import React, { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';

import FileUploader from './components/FileUploader';
import ChatInterface from './components/ChatInterface';
import { processExcelFile } from './utils/dataProcessor';
import { generateDummyData } from './utils/dummyGenerator';

import './styles/index.css';
import './styles/retro.css';

function App() {
  const [rawData, setRawData] = useState(null);
  const [topHeight, setTopHeight] = useState(240);
  const [isTopMinimized, setIsTopMinimized] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  const containerRef = useRef(null);
  const isDragging = useRef(false);
  const currency = 'JPY';

  // Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
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
      <FileUploader onFileUpload={handleFileUpload} onUseDemo={handleUseDemo} />
    );
  }

  const displayData = rawData;

  return (
    <div className="app-bg flex flex-col min-h-screen p-0" style={{ paddingBottom: '38px' }}>
      <div ref={containerRef} className="max-w-6xl mx-auto flex flex-col h-[calc(100vh-38px)] w-full p-3 flex-1 gap-1">

        {/* Top Panel: Data Preview */}
        {!isTopMinimized && (
          <div
            className="app-card flex-shrink-0 flex flex-col"
            style={{ height: `${topHeight}px` }}
          >
            <div className="app-card-header">
              <div className="app-card-title">
                <span className="title-dot" />
                Data Preview
                <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '6px' }}>
                  {rawData.length} rows
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  className="app-btn"
                  onClick={() => setRawData(null)}
                  style={{ fontSize: '11px', padding: '3px 8px' }}
                >
                  New File
                </button>
                <div className="app-window-controls">
                  <button className="app-window-btn minimize" onClick={() => setIsTopMinimized(true)} title="Collapse data panel" />
                  <button className="app-window-btn close" onClick={() => setRawData(null)} title="Close" />
                </div>
              </div>
            </div>

            <div className="app-card-body flex-1 min-h-0 overflow-auto modern-scrollbar p-0">
              <table className="app-table w-full">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Remarks</th>
                    <th>Category</th>
                    <th style={{ textAlign: 'right' }}>Expense</th>
                    <th>Onetime</th>
                    <th>For Others</th>
                  </tr>
                </thead>
                <tbody>
                  {displayData.map((row, i) => (
                    <tr key={i}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{format(row.Date, 'yyyy-MM-dd')}</td>
                      <td>{row.remarks || ''}</td>
                      <td>
                        <span className="app-chip" style={{ cursor: 'default', fontSize: '11px', padding: '2px 8px' }}>
                          {row.NewCategory || row.Category || '—'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                        {(row.Expense || 0).toLocaleString()} {currency}
                      </td>
                      <td>
                        <span style={{ color: row.Onetime ? 'var(--success)' : 'var(--text-muted)', fontWeight: 500, fontSize: '12px' }}>
                          {row.Onetime ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: row['for others'] ? 'var(--success)' : 'var(--text-muted)', fontWeight: 500, fontSize: '12px' }}>
                          {row['for others'] ? 'Yes' : 'No'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Draggable Divider */}
        {!isTopMinimized && (
          <div className="app-divider" onMouseDown={handleMouseDown} />
        )}

        {/* Bottom Panel: Chat Interface */}
        <div className="app-card flex-1 flex flex-col min-h-0">
          <div className="app-card-header">
            <div className="app-card-title">
              <span className="title-dot" style={{ background: 'var(--success)' }} />
              ExpenseSense Assistant
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isTopMinimized && (
                <button
                  className="app-btn"
                  style={{ fontSize: '11px', padding: '3px 8px' }}
                  onClick={() => setIsTopMinimized(false)}
                >
                  Show Data
                </button>
              )}
              <div className="app-window-controls">
                <button
                  className="app-window-btn maximize"
                  onClick={() => setIsTopMinimized(!isTopMinimized)}
                  title={isTopMinimized ? 'Show data panel' : 'Hide data panel'}
                />
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0 p-0">
            <ChatInterface
              data={rawData}
              currency={currency}
              visible={true}
              onClose={() => { }}
            />
          </div>
        </div>
      </div>

      {/* Bottom Status Bar */}
      <div className="app-toolbar">
        <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--accent)', letterSpacing: '-0.01em' }}>
          ExpenseSense
        </span>
        <div style={{ width: '1px', height: '14px', background: 'var(--border-light)', margin: '0 6px' }} />
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {rawData ? `${rawData.length} records loaded` : ''}
        </span>
        <div className="app-toolbar-clock">{currentTime}</div>
      </div>
    </div>
  );
}

export default App;
