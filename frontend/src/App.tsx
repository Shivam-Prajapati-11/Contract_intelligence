import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { UploadZone } from './components/UploadZone';
import { ActiveJobs, Job } from './components/ActiveJobs';
import { Sidebar } from './components/Sidebar';
import { Explorer } from './components/Explorer';
import { API_BASE_URL } from './config';

export default function App() {
  const [view, setView] = useState<'upload' | 'dashboard'>('upload');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedFilename, setSelectedFilename] = useState<string | null>(null);
  
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [debugData, setDebugData] = useState<any>({ total_chunks: '-', sections: [] });
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Keep track of active poll intervals
  const activePolls = useRef<Record<string, number>>({});

  // Clean up all active intervals when App unmounts
  useEffect(() => {
    return () => {
      Object.values(activePolls.current).forEach(clearInterval);
    };
  }, []);

  const handleFilesSelected = async (files: FileList) => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      await uploadFile(file);
    }
  };

  const uploadFile = async (file: File) => {
    const tempId = `uploading-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    
    // 1. Create a placeholder job card
    const newJob: Job = {
      id: tempId,
      filename: file.name,
      status: 'uploading',
      statusText: 'Uploading...',
      progress: 20
    };
    
    setJobs((prev) => [newJob, ...prev]);

    const formData = new FormData();
    formData.append('files', file);

    try {
      const res = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Upload failed');
      }

      const data = await res.json();
      const jobId = data.job_id;

      // 2. Replace the placeholder job with the real job ID and start polling
      setJobs((prev) =>
        prev.map((job) =>
          job.id === tempId
            ? { ...job, id: jobId, status: 'processing', statusText: 'Queued for OCR parsing...', progress: 40 }
            : job
        )
      );

      startPolling(jobId, file.name);
    } catch (err: any) {
      console.error('Upload error', err);
      setJobs((prev) =>
        prev.map((job) =>
          job.id === tempId
            ? { ...job, status: 'failed', statusText: err.message || 'Upload failed', progress: 100 }
            : job
        )
      );
    }
  };

  const startPolling = (jobId: string, filename: string) => {
    if (activePolls.current[jobId]) return;

    const intervalId = window.setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/status/${jobId}`);
        if (!res.ok) throw new Error('Status poll failed');
        
        const data = await res.json();
        
        if (data.status === 'completed') {
          // Clear interval
          window.clearInterval(intervalId);
          delete activePolls.current[jobId];

          setJobs((prev) =>
            prev.map((job) =>
              job.id === jobId
                ? { ...job, status: 'completed', statusText: 'Completed', progress: 100 }
                : job
            )
          );
        } else if (data.status === 'failed') {
          window.clearInterval(intervalId);
          delete activePolls.current[jobId];

          setJobs((prev) =>
            prev.map((job) =>
              job.id === jobId
                ? { ...job, status: 'failed', statusText: 'Parsing failed', progress: 100 }
                : job
            )
          );
        } else {
          // Update processing progress
          setJobs((prev) =>
            prev.map((job) =>
              job.id === jobId
                ? { ...job, progress: 70, statusText: 'OCR text parsing active...' }
                : job
            )
          );
        }
      } catch (err) {
        console.error('Polling error', err);
      }
    }, 2000);

    activePolls.current[jobId] = intervalId;
  };

  const handleAnalyze = async (jobId: string, filename: string) => {
    setIsAnalyzing(true);
    setSelectedJobId(jobId);
    setSelectedFilename(filename);

    try {
      // Fetch analysis results & chunks metadata in parallel
      const [analysisRes, debugRes] = await Promise.all([
        fetch(`${API_BASE_URL}/analyze/${jobId}`),
        fetch(`${API_BASE_URL}/debug/chunks/${jobId}`)
      ]);

      if (!analysisRes.ok) throw new Error('Analysis request failed');
      
      const analysisJson = await analysisRes.json();
      const debugJson = debugRes.ok ? await debugRes.json() : { total_chunks: '-', sections: [] };

      setAnalysisData(analysisJson);
      setDebugData(debugJson);
      setView('dashboard');
    } catch (err: any) {
      console.error('Analysis error', err);
      alert(`Analysis failed: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleBackToUpload = () => {
    setView('upload');
    setAnalysisData(null);
    setDebugData({ total_chunks: '-', sections: [] });
    setSelectedJobId(null);
    setSelectedFilename(null);
  };

  return (
    <div className="container">
      {/* Header showing logo & live health indicator */}
      <Header />

      {/* Main Views */}
      {view === 'upload' ? (
        <div className="upload-view">
          <div className="glass-card">
            <UploadZone onFilesSelected={handleFilesSelected} />
            <ActiveJobs jobs={jobs} onAnalyze={handleAnalyze} />
          </div>
        </div>
      ) : (
        <div className="dashboard-view">
          <Sidebar 
            filename={selectedFilename || 'Contract'} 
            jobId={selectedJobId || ''} 
            debugData={debugData} 
            riskSummary={analysisData?.risk_summary || { overall_risk: 'LOW', total_risk_score: 0, high_risk_flags: 0, medium_risk_flags: 0 }}
            onBackToUpload={handleBackToUpload}
          />
          <Explorer results={analysisData?.extraction_results || {}} />
        </div>
      )}

      {/* Glowing Loading Modal Overlay */}
      {isAnalyzing && (
        <div className="analysis-loader-overlay">
          <div className="glass-card analysis-loader-content">
            <span className="loader-spinner">⚙️</span>
            <h2>Analyzing Contract Risks...</h2>
            <p>
              Zaalima AI is sequentially analyzing 16 legal categories in your contract, scoring risk factors, and cross-referencing indices. This usually takes 1-2 minutes.
            </p>
            <div className="progress-container">
              <div className="progress-bar animated" />
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '15px', fontFamily: 'monospace' }}>
              Job ID: {selectedJobId}
            </p>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer>
        <p>© 2026 Zaalima Development. Confidential legal audit support agent interface.</p>
      </footer>
    </div>
  );
}
