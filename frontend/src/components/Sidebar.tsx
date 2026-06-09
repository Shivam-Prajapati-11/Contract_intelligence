import React from 'react';

interface SidebarProps {
  filename: string;
  jobId: string;
  debugData: {
    total_chunks?: number | string;
    sections?: any[];
  };
  riskSummary: {
    overall_risk: string;
    total_risk_score: number;
    high_risk_flags: number;
    medium_risk_flags: number;
    categories_analyzed?: number;
  };
  onBackToUpload: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  filename,
  jobId,
  debugData,
  riskSummary,
  onBackToUpload
}) => {
  // Strategy detection
  let strategyText = 'Hybrid OCR + Native PDF';
  if (filename) {
    if (filename.toLowerCase().endsWith('.docx')) {
      strategyText = 'docx Structure Parser';
    } else if (filename.match(/\.(jpg|jpeg|png)$/i)) {
      strategyText = 'Direct OCR Engine';
    } else {
      strategyText = 'PyMuPDF Native Text';
    }
  }

  // Calculate circular meter attributes
  const radius = 55;
  const circumference = 2 * Math.PI * radius; // ~345.57
  
  // Map risk level to a percentage and color
  let riskPercent = 0.25;
  let riskColor = 'var(--risk-low)';
  
  const overallRisk = (riskSummary.overall_risk || 'LOW').toUpperCase();
  if (overallRisk === 'MEDIUM') {
    riskPercent = 0.50;
    riskColor = 'var(--risk-medium)';
  } else if (overallRisk === 'HIGH') {
    riskPercent = 0.75;
    riskColor = 'var(--risk-high)';
  } else if (overallRisk === 'CRITICAL') {
    riskPercent = 1.00;
    riskColor = 'var(--risk-critical)';
  }

  const strokeDashoffset = circumference * (1 - riskPercent);

  return (
    <div className="sidebar">
      {/* Back button and profile */}
      <div className="glass-card doc-info-card">
        <button 
          type="button" 
          onClick={onBackToUpload} 
          className="btn-secondary" 
          style={{ marginBottom: '20px', width: '100%' }}
        >
          ← Upload Another File
        </button>
        <h2>Document Profile</h2>
        <p className="filename-meta">{filename || 'Loading...'}</p>
        
        <div className="doc-meta-item">
          <span>Job ID</span>
          <span style={{ fontFamily: 'monospace' }} title={jobId}>
            {jobId ? `${jobId.substring(0, 8)}...` : '-'}
          </span>
        </div>
        <div className="doc-meta-item">
          <span>Parser Strategy</span>
          <span>{strategyText}</span>
        </div>
        <div className="doc-meta-item">
          <span>Chunks Extracted</span>
          <span>{debugData.total_chunks ?? '-'}</span>
        </div>
        <div className="doc-meta-item">
          <span>Sections Identified</span>
          <span>{debugData.sections?.length ?? '-'}</span>
        </div>
      </div>

      {/* Risk Gauge Assessment */}
      <div className="glass-card risk-meter-card">
        <h2>Overall Assessment</h2>
        
        <div className="risk-meter-wrapper">
          <svg className="risk-meter-svg" width="140" height="140">
            <circle 
              className="risk-meter-bg" 
              cx="70" 
              cy="70" 
              r={radius} 
            />
            <circle 
              className="risk-meter-fill" 
              cx="70" 
              cy="70" 
              r={radius} 
              style={{
                strokeDasharray: circumference,
                strokeDashoffset: strokeDashoffset,
                stroke: riskColor
              }}
            />
          </svg>
          <div className="risk-meter-value">
            <span className={`risk-meter-label color-${overallRisk}`}>{overallRisk}</span>
            <span className="risk-meter-desc">Risk Level</span>
          </div>
        </div>
        
        <p className="risk-score-subtitle">
          Accumulated Risk Points: {riskSummary.total_risk_score}
        </p>
        
        <div className="risk-breakdown-row">
          <div className="breakdown-item">
            <span className="breakdown-val" style={{ color: 'var(--risk-high)' }}>
              {riskSummary.high_risk_flags}
            </span>
            <span className="breakdown-label">High Risk</span>
          </div>
          <div className="breakdown-item">
            <span className="breakdown-val" style={{ color: 'var(--risk-medium)' }}>
              {riskSummary.medium_risk_flags}
            </span>
            <span className="breakdown-label">Med Risk</span>
          </div>
          <div className="breakdown-item">
            <span className="breakdown-val">
              {riskSummary.categories_analyzed ?? 16}
            </span>
            <span className="breakdown-label">Categories</span>
          </div>
        </div>
      </div>
    </div>
  );
};
