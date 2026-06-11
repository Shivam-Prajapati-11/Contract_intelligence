from pydantic import BaseModel, Field
from typing import Optional


class UploadResponse(BaseModel):
    """Response model for file upload."""
    job_id: str
    message: str = "Files uploaded successfully"
    total_files: int


class StatusResponse(BaseModel):
    """Response model for job status."""
    job_id: str
    status: str  # "processing", "completed", "not_found"
    completed: int
    total: int
    results: list[dict] = []


class ExtractionResult(BaseModel):
    """Single extraction result for a CUAD category."""
    question: str
    extracted_answer: Optional[str] = None
    confidence_score: float = 0.0
    confidence_label: str = "NOT_FOUND"  # HIGH, MEDIUM, LOW, NOT_FOUND
    risk_level: str = "LOW"  # LOW, MEDIUM, HIGH
    risk_flag: Optional[str] = None


class RiskSummary(BaseModel):
    """Overall risk assessment summary."""
    overall_risk: str  # LOW, MEDIUM, HIGH, CRITICAL
    total_risk_score: int = 0
    high_risk_flags: int = 0
    medium_risk_flags: int = 0
    categories_analyzed: int = 0


class DocumentMetadata(BaseModel):
    """Uploaded document metadata."""
    filename: Optional[str] = None
    total_files: Optional[int] = None


class AnalysisResponse(BaseModel):
    """Full analysis response model."""
    job_id: str
    document: DocumentMetadata
    risk_summary: RiskSummary
    extraction_results: dict[str, ExtractionResult]


class HealthResponse(BaseModel):
    """Health check response."""
    status: str = "healthy"
    version: str
    services: dict[str, str] = {}


class ErrorResponse(BaseModel):
    """Standard error response."""
    error: str
    detail: Optional[str] = None


class ChatRequest(BaseModel):
    """Request model for chatting with the contract."""
    message: str
    history: list[dict[str, str]] = []
