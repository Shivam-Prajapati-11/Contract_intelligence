import React, { useEffect, useState } from 'react';
import { API_BASE_URL } from '../config';

export const Header: React.FC = () => {
  const [health, setHealth] = useState<'active' | 'degraded' | 'offline'>('active');
  const [healthText, setHealthText] = useState('Services: Active');

  const checkHealth = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/health`);
      if (!res.ok) throw new Error('Health check error');
      const data = await res.json();
      
      if (data.status === 'healthy') {
        setHealth('active');
        setHealthText('Services: Active');
      } else {
        setHealth('degraded');
        setHealthText('Services: Degraded');
      }
    } catch (err) {
      setHealth('offline');
      setHealthText('Services: Offline');
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header>
      <div className="logo-group">
        <span className="logo-icon">⚖️</span>
        <div className="logo-text">
          <h1>ZAALIMA</h1>
          <p>Contract Intelligence & Risk Platform</p>
        </div>
      </div>
      
      <div className="health-panel">
        <div className={`health-dot ${health}`} />
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
          {healthText}
        </span>
        <a 
          href={`${API_BASE_URL}/docs`} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="btn-secondary" 
          style={{ padding: '6px 12px', fontSize: '0.8rem', marginLeft: '12px' }}
        >
          API Docs
        </a>
      </div>
    </header>
  );
};
