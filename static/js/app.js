// ⚖️ Contract Intelligence Platform - Frontend Controller

document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const healthDot = document.getElementById('healthDot');
    const healthLabel = document.getElementById('healthLabel');
    const uploadView = document.getElementById('uploadView');
    const dashboardView = document.getElementById('dashboardView');
    
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const browseBtn = document.getElementById('browseBtn');
    
    const jobsSection = document.getElementById('jobsSection');
    const jobsList = document.getElementById('jobsList');
    
    const backToUploadBtn = document.getElementById('backToUploadBtn');
    const docFilename = document.getElementById('docFilename');
    const metaJobId = document.getElementById('metaJobId');
    const metaParser = document.getElementById('metaParser');
    const metaChunksCount = document.getElementById('metaChunksCount');
    const metaSectionsCount = document.getElementById('metaSectionsCount');
    
    const riskDisplay = document.getElementById('riskDisplay');
    const riskScoreSubtitle = document.getElementById('riskScoreSubtitle');
    const highRiskCount = document.getElementById('highRiskCount');
    const medRiskCount = document.getElementById('medRiskCount');
    
    const accordionList = document.getElementById('accordionList');
    
    // Emojis for legal categories
    const categoryEmojis = {
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

    // Tracking active jobs and intervals
    const activePolls = {};

    // 1. Health check
    async function checkHealth() {
        try {
            const res = await fetch('/health');
            if (!res.ok) throw new Error('Health check status error');
            const data = await res.json();
            
            if (data.status === 'healthy') {
                healthDot.className = 'health-dot';
                healthLabel.textContent = 'Services: Active';
                healthLabel.style.color = '#10b981';
            } else {
                healthDot.className = 'health-dot degraded';
                healthLabel.textContent = 'Services: Degraded';
                healthLabel.style.color = '#f59e0b';
            }
        } catch (err) {
            console.error('Health check failed', err);
            healthDot.className = 'health-dot unhealthy';
            healthLabel.textContent = 'Services: Offline';
            healthLabel.style.color = '#ef4444';
        }
    }
    
    checkHealth();
    // Poll health every 30 seconds
    setInterval(checkHealth, 30000);

    // 2. File Upload Event Handlers
    browseBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => handleFiles(fileInput.files));
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files) {
            handleFiles(e.dataTransfer.files);
        }
    });

    async function handleFiles(files) {
        if (!files.length) return;
        
        jobsSection.style.display = 'block';
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            await uploadFile(file);
        }
        
        // Reset file input so same file can be uploaded again if needed
        fileInput.value = '';
    }

    async function uploadFile(file) {
        const formData = new FormData();
        formData.append('files', file);
        
        // Create pre-upload placeholder card
        const cardId = 'uploading-' + Date.now() + Math.random().toString(36).substr(2, 5);
        createJobCard(cardId, file.name, 'Uploading...', 'processing', 20);
        
        try {
            const res = await fetch('/upload', {
                method: 'POST',
                body: formData
            });
            
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.detail || 'Upload failed');
            }
            
            const data = await res.json();
            const job_id = data.job_id;
            
            // Remove uploading card and insert tracked job card
            const oldCard = document.getElementById(cardId);
            if (oldCard) oldCard.remove();
            
            createJobCard(job_id, file.name, 'Queued for OCR parsing...', 'processing', 40);
            
            // Start polling
            pollJobStatus(job_id, file.name);
        } catch (err) {
            console.error('Upload error', err);
            const oldCard = document.getElementById(cardId);
            if (oldCard) {
                oldCard.querySelector('.job-status-row').innerHTML = `
                    <span class="badge badge-error">Failed</span>
                    <span class="job-id" style="color: var(--risk-critical);">${err.message}</span>
                `;
                oldCard.querySelector('.progress-bar').style.background = 'var(--risk-critical)';
                oldCard.querySelector('.progress-bar').style.width = '100%';
            }
        }
    }

    function createJobCard(job_id, filename, textStatus, statusClass, initialPercent) {
        const card = document.createElement('div');
        card.id = job_id;
        card.className = 'job-card';
        card.innerHTML = `
            <div class="job-header">
                <span class="job-filename">${filename}</span>
                <span class="job-id">ID: ${job_id}</span>
            </div>
            <div class="progress-container">
                <div class="progress-bar" style="width: ${initialPercent}%;"></div>
            </div>
            <div class="job-status-row">
                <span class="badge badge-processing">${statusClass === 'processing' ? 'Processing' : statusClass}</span>
                <span class="job-id status-text">${textStatus}</span>
            </div>
        `;
        jobsList.prepend(card);
    }

    function pollJobStatus(job_id, filename) {
        if (activePolls[job_id]) return;
        
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/status/${job_id}`);
                if (!res.ok) throw new Error('Status poll failed');
                
                const data = await res.json();
                const card = document.getElementById(job_id);
                
                if (!card) {
                    clearInterval(interval);
                    delete activePolls[job_id];
                    return;
                }
                
                const bar = card.querySelector('.progress-bar');
                const statusRow = card.querySelector('.job-status-row');
                
                if (data.status === 'completed') {
                    clearInterval(interval);
                    delete activePolls[job_id];
                    
                    bar.style.width = '100%';
                    bar.style.background = 'var(--risk-low)';
                    
                    statusRow.innerHTML = `
                        <span class="badge badge-completed">Completed</span>
                        <button class="btn-primary analyze-btn" data-job-id="${job_id}" data-filename="${filename}" style="padding: 6px 14px; font-size: 0.8rem; border-radius: 6px; box-shadow: none;">
                            Analyze Contract
                        </button>
                    `;
                    
                    // Attach event listener to analyze button
                    statusRow.querySelector('.analyze-btn').addEventListener('click', (e) => {
                        const jid = e.target.getAttribute('data-job-id');
                        const fname = e.target.getAttribute('data-filename');
                        runContractAnalysis(jid, fname);
                    });
                } else {
                    // Update processing status
                    bar.style.width = '70%';
                    card.querySelector('.status-text').textContent = 'OCR text parsing active...';
                }
            } catch (err) {
                console.error(err);
            }
        }, 2000);
        
        activePolls[job_id] = interval;
    }

    // 3. Run RAG + LLM analysis
    async function runContractAnalysis(job_id, filename) {
        // Show Loading Overlay or processing dialog in place of upload card
        const loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'analysisLoader';
        loadingOverlay.className = 'glass-card';
        loadingOverlay.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 1000;
            width: 90%;
            max-width: 600px;
            text-align: center;
            padding: 40px;
            box-shadow: 0 0 100px rgba(0,0,0,0.8);
        `;
        loadingOverlay.innerHTML = `
            <span class="upload-icon" style="animation: spin 3s infinite linear; display: inline-block;">⚙️</span>
            <h2 style="margin-top: 20px;">Analyzing Contract Risks...</h2>
            <p style="color: var(--text-secondary); margin-top: 10px;">
                Zaalima AI is sequentially analyzing 16 legal categories in your contract, scoring risk factors, and cross-referencing indices. This usually takes 1-2 minutes.
            </p>
            <div class="progress-container" style="margin-top: 30px; height: 10px;">
                <div class="progress-bar animated"></div>
            </div>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 15px; font-family: monospace;">
                Job ID: ${job_id}
            </p>
        `;
        
        // Add a block background to dim screen
        const modalBackdrop = document.createElement('div');
        modalBackdrop.id = 'modalBackdrop';
        modalBackdrop.style.cssText = `
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.7);
            backdrop-filter: blur(4px);
            z-index: 999;
        `;
        
        document.body.appendChild(modalBackdrop);
        document.body.appendChild(loadingOverlay);

        try {
            // Simultaneously fetch debug chunks to get chunk metrics
            const [analysisRes, debugRes] = await Promise.all([
                fetch(`/analyze/${job_id}`),
                fetch(`/debug/chunks/${job_id}`)
            ]);

            if (!analysisRes.ok) throw new Error('Analysis request failed');
            
            const analysisData = await resToJSON(analysisRes);
            const debugData = debugRes.ok ? await resToJSON(debugRes) : { total_chunks: '-', sections: [] };
            
            renderAnalysisDashboard(job_id, filename, analysisData, debugData);
            
        } catch (err) {
            console.error('Analysis error', err);
            alert(`Analysis failed: ${err.message}`);
        } finally {
            // Clean up loaders
            const loader = document.getElementById('analysisLoader');
            const backdrop = document.getElementById('modalBackdrop');
            if (loader) loader.remove();
            if (backdrop) backdrop.remove();
        }
    }

    async function resToJSON(res) {
        return await res.json();
    }

    // 4. Render results to Accordion and Sidebar
    function renderAnalysisDashboard(job_id, filename, analysis, debug) {
        // Toggle view
        uploadView.style.display = 'none';
        dashboardView.style.display = 'grid';
        
        // Populate profile cards
        docFilename.textContent = filename;
        metaJobId.textContent = job_id.substring(0, 8) + '...';
        metaJobId.title = job_id;
        
        // Strategy detection (native text if mostly done without error or fallback)
        let strategyText = 'Hybrid OCR + Native PDF';
        if (debug.chunks && debug.chunks.length > 0) {
            // If they are mostly images or scanned pages
            strategyText = filename.toLowerCase().endsWith('.docx') ? 'docx Structure Parser' : 
                           (filename.match(/\.(jpg|jpeg|png)$/i) ? 'Direct OCR Engine' : 'PyMuPDF Native Text');
        }
        metaParser.textContent = strategyText;
        metaChunksCount.textContent = debug.total_chunks || '-';
        metaSectionsCount.textContent = (debug.sections && debug.sections.length) ? debug.sections.length : '-';

        // Overall risk summary
        const summary = analysis.risk_summary;
        riskDisplay.textContent = summary.overall_risk;
        riskDisplay.className = `risk-level-display risk-level-${summary.overall_risk}`;
        riskScoreSubtitle.textContent = `Accumulated Risk Points: ${summary.total_risk_score}`;
        highRiskCount.textContent = summary.high_risk_flags;
        medRiskCount.textContent = summary.medium_risk_flags;

        // Render accordion panels
        accordionList.innerHTML = '';
        const results = analysis.extraction_results;
        
        for (const [category, item] of Object.entries(results)) {
            const emoji = categoryEmojis[category] || '📄';
            const itemElement = document.createElement('div');
            itemElement.className = 'accordion-item';
            
            // Badges
            const rBadge = item.risk_level !== 'LOW' && item.risk_level !== 'NONE' ? 
                `<span class="badge badge-risk-${item.risk_level}">${item.risk_level} Risk</span>` : '';
            
            const confBadge = `<span class="badge badge-conf-${item.confidence_label}">${item.confidence_label}</span>`;
            
            itemElement.innerHTML = `
                <div class="accordion-header">
                    <div class="accordion-header-left">
                        <span class="category-icon">${emoji}</span>
                        <span class="category-title">${category}</span>
                    </div>
                    <div class="accordion-header-right">
                        ${rBadge}
                        ${confBadge}
                        <span class="chevron">▼</span>
                    </div>
                </div>
                <div class="accordion-content">
                    <div class="accordion-inner-body">
                        <div class="question-block">
                            <strong>Prompt Target:</strong> "${item.question || 'What is the detail?'}"
                        </div>
                        
                        <div class="clause-block ${item.extracted_answer ? '' : 'not-found'}">${
                            item.extracted_answer ? escapeHTML(item.extracted_answer) : 'No matching clause or information was identified in this contract.'
                        }</div>
                        
                        ${item.risk_flag ? `
                            <div class="risk-alert-banner alert-${item.risk_level}">
                                <span class="alert-icon">⚠️</span>
                                <div>
                                    <strong>Risk Flag Identified:</strong> ${escapeHTML(item.risk_flag)}
                                </div>
                            </div>
                        ` : ''}

                        <div class="confidence-rating">
                            <span>Confidence Index:</span>
                            <div class="confidence-bar-outer">
                                <div class="confidence-bar-inner" style="width: ${item.confidence_score * 10}%; background-color: var(--conf-${item.confidence_label});"></div>
                            </div>
                            <span>${item.confidence_score}/10</span>
                        </div>
                    </div>
                </div>
            `;
            
            accordionList.appendChild(itemElement);

            // Click listener for accordion head
            const header = itemElement.querySelector('.accordion-header');
            header.addEventListener('click', () => {
                const isActive = itemElement.classList.contains('active');
                
                // Close other items
                document.querySelectorAll('.accordion-item').forEach(el => {
                    el.classList.remove('active');
                    el.querySelector('.accordion-content').style.maxHeight = null;
                });
                
                if (!isActive) {
                    itemElement.classList.add('active');
                    const content = itemElement.querySelector('.accordion-content');
                    // Add 100 to scrollheight to account for padding/margin
                    content.style.maxHeight = (content.scrollHeight + 100) + 'px';
                }
            });
        }
    }

    // Helper: Escape HTML strings to prevent HTML injection
    function escapeHTML(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // 5. Back to upload view
    backToUploadBtn.addEventListener('click', () => {
        dashboardView.style.display = 'none';
        uploadView.style.display = 'block';
    });
});

// Spin Animation CSS definition added on-the-fly for loader
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);
