import React, { useState } from 'react';
import { ChevronDown, AlertTriangle } from 'lucide-react';

interface ExtractionItem {
  question?: string;
  extracted_answer: string;
  confidence_score: number;
  confidence_label: string;
  risk_level: string;
  risk_flag: string | null;
}

interface ExplorerProps {
  results: Record<string, ExtractionItem>;
}

const categoryEmojis: Record<string, string> = {
  "Document Name": "📄",
  "Parties": "🤝",
  "Effective Date": "📅",
  "Expiration Date": "⏳",
  "Governing Law": "⚖️",
  "Assignment": "🔗",
  "Renewal Term": "🔄",
  "Payment Terms": "💰",
  "Limitation of Liability": "🛡️",
  "Indemnification": "🛡️",
  "Non-Compete": "🚫",
  "Confidentiality": "🔒",
  "Non-Solicitation": "👥",
  "Termination for Convenience": "🚪",
  "Termination for Cause": "💔",
  "Intellectual Property Ownership": "💡"
};

export const Explorer: React.FC<ExplorerProps> = ({ results }) => {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const toggleCategory = (category: string) => {
    setActiveCategory(activeCategory === category ? null : category);
  };

  return (
    <div className="explorer-panel">
      <div className="explorer-header">
        <h2>Extracted Legal Categories</h2>
        <p>Select a category to view the extracted clause and risk details</p>
      </div>

      <div className="accordion-list">
        {Object.entries(results).map(([category, item]) => {
          const isActive = activeCategory === category;
          const emoji = categoryEmojis[category] || '📄';
          
          const hasRisk = item.risk_level !== 'LOW' && item.risk_level !== 'NONE' && item.risk_level !== 'NOT_FOUND';
          const confidenceColor = `var(--conf-${(item.confidence_label || 'low').toLowerCase().replace(' ', '_')})`;

          return (
            <div 
              key={category} 
              className={`accordion-item ${isActive ? 'active' : ''}`}
            >
              <div 
                className="accordion-header" 
                onClick={() => toggleCategory(category)}
              >
                <div className="accordion-header-left">
                  <span className="category-icon">{emoji}</span>
                  <span className="category-title">{category}</span>
                </div>
                
                <div className="accordion-header-right">
                  {hasRisk && (
                    <span className={`badge badge-risk-${item.risk_level}`}>
                      {item.risk_level} Risk
                    </span>
                  )}
                  <span className={`badge badge-conf-${item.confidence_label}`}>
                    {item.confidence_label}
                  </span>
                  <span className="chevron-icon">
                    <ChevronDown size={16} />
                  </span>
                </div>
              </div>

              <div 
                className="accordion-content"
                style={{ 
                  maxHeight: isActive ? '1000px' : '0px',
                  transition: 'max-height 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              >
                <div className="accordion-inner-body">
                  <div className="question-block">
                    <strong>Prompt Target:</strong> "{item.question || 'What is the detail?'}"
                  </div>

                  <div className={`clause-block ${item.extracted_answer ? '' : 'not-found'}`}>
                    {item.extracted_answer || 'No matching clause or information was identified in this contract.'}
                  </div>

                  {item.risk_flag && (
                    <div className={`risk-alert-banner alert-${item.risk_level}`}>
                      <span className="risk-alert-banner-icon">
                        <AlertTriangle size={16} />
                      </span>
                      <div>
                        <strong>Risk Flag Identified:</strong> {item.risk_flag}
                      </div>
                    </div>
                  )}

                  <div className="confidence-rating">
                    <span>Confidence Index:</span>
                    <div className="confidence-bar-outer">
                      <div 
                        className="confidence-bar-inner" 
                        style={{ 
                          width: `${(item.confidence_score || 0) * 10}%`, 
                          backgroundColor: confidenceColor 
                        }} 
                      />
                    </div>
                    <span>{item.confidence_score}/10</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
