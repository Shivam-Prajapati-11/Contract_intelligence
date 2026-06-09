import React from 'react';

export interface Job {
  id: string;
  filename: string;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  statusText: string;
  progress: number;
}

interface ActiveJobsProps {
  jobs: Job[];
  onAnalyze: (jobId: string, filename: string) => void;
}

export const ActiveJobs: React.FC<ActiveJobsProps> = ({ jobs, onAnalyze }) => {
  if (jobs.length === 0) return null;

  return (
    <div className="jobs-section">
      <h2>Active Processing Queue</h2>
      <div className="jobs-list">
        {jobs.map((job) => {
          const isCompleted = job.status === 'completed';
          const isFailed = job.status === 'failed';
          
          let badgeClass = 'badge-processing';
          let badgeLabel = 'Processing';
          
          if (isCompleted) {
            badgeClass = 'badge-completed';
            badgeLabel = 'Completed';
          } else if (isFailed) {
            badgeClass = 'badge-error';
            badgeLabel = 'Failed';
          }

          let barBg = 'var(--accent-gradient)';
          if (isCompleted) {
            barBg = 'var(--risk-low)';
          } else if (isFailed) {
            barBg = 'var(--risk-critical)';
          }

          return (
            <div key={job.id} className="job-card">
              <div className="job-header">
                <span className="job-filename">{job.filename}</span>
                <span className="job-id">ID: {job.id.startsWith('uploading-') ? 'Uploading...' : job.id}</span>
              </div>
              
              <div className="progress-container">
                <div 
                  className="progress-bar" 
                  style={{ width: `${job.progress}%`, background: barBg }} 
                />
              </div>
              
              <div className="job-status-row">
                <span className={`badge ${badgeClass}`}>{badgeLabel}</span>
                {isCompleted ? (
                  <button 
                    type="button"
                    className="btn-primary" 
                    onClick={() => onAnalyze(job.id, job.filename)}
                    style={{ padding: '6px 14px', fontSize: '0.8rem', borderRadius: '6px', boxShadow: 'none' }}
                  >
                    Analyze Contract
                  </button>
                ) : (
                  <span className="job-id status-text" style={{ color: isFailed ? 'var(--risk-critical)' : 'inherit' }}>
                    {job.statusText}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
