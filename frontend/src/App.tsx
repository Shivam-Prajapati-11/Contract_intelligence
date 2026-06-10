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
  const [threads, setThreads] = useState<any[]>([]);

  // Keep track of active poll intervals
  const activePolls = useRef<Record<string, number>>({});
  const debugDataRef = useRef(debugData);

  // Load threads history on mount
  useEffect(() => {
    const loadedThreads = localStorage.getItem('zaalima_threads');
    if (loadedThreads) {
      try {
        setThreads(JSON.parse(loadedThreads));
      } catch (err) {
        console.error('Failed to parse history threads', err);
      }
    }
  }, []);

  // Sync debugDataRef with state
  useEffect(() => {
    debugDataRef.current = debugData;
  }, [debugData]);

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

  const saveToHistory = (jobId: string, filename: string, finalData: any) => {
    setThreads((prevThreads) => {
      const filtered = prevThreads.filter((t) => t.id !== jobId);
      const newThread = {
        id: jobId,
        filename: filename,
        timestamp: new Date().toLocaleString(),
        riskSummary: finalData.risk_summary,
        extraction_results: finalData.extraction_results,
        debugData: debugDataRef.current || { total_chunks: '-', sections: [] }
      };

      const updated = [newThread, ...filtered];
      localStorage.setItem('zaalima_threads', JSON.stringify(updated));
      return updated;
    });
  };

  const fetchStaticAnalysis = async (jobId: string, filename: string) => {
    setIsAnalyzing(true);
    try {
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

      saveToHistory(jobId, filename, analysisJson);
    } catch (err: any) {
      console.error('Static fallback error:', err);
      alert(`Fallback analysis failed: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnalyze = async (jobId: string, filename: string) => {
    setIsAnalyzing(true);
    setSelectedJobId(jobId);
    setSelectedFilename(filename);

    // Fetch debug chunks info in background
    fetch(`${API_BASE_URL}/debug/chunks/${jobId}`)
      .then((res) => (res.ok ? res.json() : { total_chunks: '-', sections: [] }))
      .then((debugJson) => setDebugData(debugJson))
      .catch((err) => console.error('Failed to load debug chunks', err));

    // Initialize blank results for 16 categories
    const categories = [
      "Document Name", "Parties", "Effective Date", "Expiration Date",
      "Governing Law", "Assignment", "Renewal Term", "Payment Terms",
      "Limitation of Liability", "Indemnification", "Non-Compete",
      "Confidentiality", "Non-Solicitation", "Termination for Convenience",
      "Termination for Cause", "Intellectual Property Ownership"
    ];
    const initialResults: Record<string, any> = {};
    for (const cat of categories) {
      initialResults[cat] = {
        question: `Extracting ${cat.toLowerCase()}...`,
        extracted_answer: "",
        confidence_score: 0,
        confidence_label: "NOT_FOUND",
        risk_level: "LOW",
        risk_flag: null,
        status: "waiting"
      };
    }

    setAnalysisData({
      job_id: jobId,
      risk_summary: {
        overall_risk: "LOW",
        total_risk_score: 0,
        high_risk_flags: 0,
        medium_risk_flags: 0,
        categories_analyzed: 0
      },
      extraction_results: initialResults
    });

    setView('dashboard');

    try {
      const eventSource = new EventSource(`${API_BASE_URL}/analyze/stream/${jobId}`);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.status === 'start') {
            setAnalysisData((prev: any) => {
              if (!prev) return prev;
              const updatedResults = { ...prev.extraction_results };
              if (updatedResults[data.category]) {
                updatedResults[data.category] = {
                  ...updatedResults[data.category],
                  question: data.question,
                  status: 'analyzing',
                  extracted_answer: ''
                };
              }
              return { ...prev, extraction_results: updatedResults };
            });
          }

          else if (data.status === 'chunk') {
            setAnalysisData((prev: any) => {
              if (!prev) return prev;
              const updatedResults = { ...prev.extraction_results };
              if (updatedResults[data.category]) {
                updatedResults[data.category] = {
                  ...updatedResults[data.category],
                  extracted_answer: (updatedResults[data.category].extracted_answer || '') + data.text
                };
              }
              return { ...prev, extraction_results: updatedResults };
            });
          }

          else if (data.status === 'done') {
            setAnalysisData((prev: any) => {
              if (!prev) return prev;
              const updatedResults = { ...prev.extraction_results };
              if (updatedResults[data.category]) {
                updatedResults[data.category] = {
                  ...updatedResults[data.category],
                  status: 'completed',
                  extracted_answer: data.extracted_answer,
                  confidence_score: data.confidence_score,
                  confidence_label: data.confidence_label,
                  risk_level: data.risk_level,
                  risk_flag: data.risk_flag
                };
              }

              const resultsList = Object.values(updatedResults);
              const highRiskCount = resultsList.filter((r: any) => r.status === 'completed' && r.risk_level === 'HIGH').length;
              const medRiskCount = resultsList.filter((r: any) => r.status === 'completed' && r.risk_level === 'MEDIUM').length;
              const totalScore = resultsList.reduce((sum: number, r: any) => {
                if (r.status !== 'completed') return sum;
                if (r.risk_level === 'HIGH') return sum + 5;
                if (r.risk_level === 'MEDIUM') return sum + 3;
                return sum;
              }, 0);

              return {
                ...prev,
                risk_summary: {
                  ...prev.risk_summary,
                  total_risk_score: totalScore,
                  high_risk_flags: highRiskCount,
                  medium_risk_flags: medRiskCount,
                  categories_analyzed: resultsList.filter((r: any) => r.status === 'completed').length
                },
                extraction_results: updatedResults
              };
            });
          }

          else if (data.status === 'final_summary') {
            eventSource.close();
            setIsAnalyzing(false);

            setAnalysisData((prev: any) => {
              if (!prev) return prev;
              const finalState = {
                ...prev,
                risk_summary: {
                  ...prev.risk_summary,
                  ...data.risk_summary
                }
              };

              saveToHistory(jobId, filename, finalState);
              return finalState;
            });
          }

          else if (data.status === 'error') {
            console.error('SSE backend error:', data.message);
            eventSource.close();
            setIsAnalyzing(false);
            alert(`Analysis stream error: ${data.message}`);
          }
        } catch (err) {
          console.error('Error parsing SSE event:', err);
        }
      };

      eventSource.onerror = (err) => {
        console.error('EventSource connection failed:', err);
        eventSource.close();
        setIsAnalyzing(false);
        fetchStaticAnalysis(jobId, filename);
      };
    } catch (err) {
      console.error('Error starting analysis stream:', err);
      setIsAnalyzing(false);
      fetchStaticAnalysis(jobId, filename);
    }
  };

  const handleSelectThread = (threadId: string) => {
    const thread = threads.find((t) => t.id === threadId);
    if (thread) {
      setSelectedJobId(thread.id);
      setSelectedFilename(thread.filename);
      setAnalysisData({
        job_id: thread.id,
        risk_summary: thread.riskSummary,
        extraction_results: thread.extraction_results
      });
      setDebugData(thread.debugData);
      setView('dashboard');
    }
  };

  const handleBackToUpload = () => {
    setView('upload');
    setAnalysisData(null);
    setDebugData({ total_chunks: '-', sections: [] });
    setSelectedJobId(null);
    setSelectedFilename(null);
  };

  const handleDeleteThread = (threadId: string) => {
    setThreads((prev) => {
      const updated = prev.filter((t) => t.id !== threadId);
      localStorage.setItem('zaalima_threads', JSON.stringify(updated));
      return updated;
    });

    if (selectedJobId === threadId) {
      handleBackToUpload();
    }
  };

  const pendingJobs = jobs.filter((job) => !threads.some((t) => t.id === job.id));

  return (
    <div className="container">
      {/* Header showing logo & live health indicator */}
      <Header />

      {/* Unified workspace grid layout */}
      <div className="dashboard-view" style={{ flex: 1 }}>
        <Sidebar
          filename={selectedFilename || 'Contract'}
          jobId={selectedJobId || ''}
          debugData={debugData}
          riskSummary={analysisData?.risk_summary || { overall_risk: 'LOW', total_risk_score: 0, high_risk_flags: 0, medium_risk_flags: 0 }}
          onBackToUpload={handleBackToUpload}
          threads={threads}
          activeThreadId={selectedJobId}
          onSelectThread={handleSelectThread}
          onDeleteThread={handleDeleteThread}
        />

        <main className="main-content" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {view === 'upload' ? (
            <div className="glass-card" style={{ maxWidth: '800px', width: '100%', margin: '0 auto' }}>
              <UploadZone onFilesSelected={handleFilesSelected} />
              {pendingJobs.length > 0 && <ActiveJobs jobs={pendingJobs} onAnalyze={handleAnalyze} />}
            </div>
          ) : (
            <Explorer results={analysisData?.extraction_results || {}} />
          )}
        </main>
      </div>

      {/* Footer */}
      <footer style={{ marginTop: '40px', padding: '20px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
        <p>© 2026 Zaalima Development. Confidential legal audit support agent interface.</p>
      </footer>
    </div>
  );
}
