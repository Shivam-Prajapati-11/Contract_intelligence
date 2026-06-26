import os
import uuid
import logging
from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import List, cast
from celery import group, Task

from ingestion.file_manager import save_file
from core.redis_client import redis_client
from core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()

ALLOWED_EXTENSIONS = set(settings.allowed_extensions)
MAX_FILE_SIZE = settings.max_file_size_mb * 1024 * 1024


@router.get("/upload")
def upload_help():
    """Explain how to use the upload endpoint from a browser."""
    return {
        "message": "Use POST /upload with multipart form-data field 'files'.",
        "allowed_extensions": sorted(ALLOWED_EXTENSIONS),
        "max_file_size_mb": settings.max_file_size_mb,
    }


@router.post("/upload")
async def upload_files(files: List[UploadFile] = File(...)):
    """Upload one or more documents for OCR processing and analysis."""
    
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")
    
    for file in files:
        _, ext = os.path.splitext(file.filename or "")
        if ext.lower() not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400, 
                detail=f"Unsupported file type: {ext}. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
            )
    
    job_id = str(uuid.uuid4())
    file_paths = []

    for file in files:
        content = await file.read()
        
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"File '{file.filename}' exceeds {settings.max_file_size_mb}MB limit"
            )
        
        filename = f"{uuid.uuid4()}_{file.filename}"
        path = save_file(content, filename)
        file_paths.append(path)

    if redis_client:
        redis_client.delete(f"job:{job_id}:results")

    original_filenames = [f.filename for f in files]

    if redis_client:
        redis_client.hset(
            f"job:{job_id}",
            mapping={
                "status": "processing",
                "total_files": len(file_paths),
                "filenames": ",".join(original_filenames),
            }
        )
    else:
        logger.warning("Redis not available — skipping job metadata storage")

    # Lazy import: prevents PaddleOCR/torch from loading in the FastAPI process at startup.
    # The Celery task is only dispatched here (not executed), so this import is safe.
    from tasks.pipeline_tasks import process_single_file
    task = cast(Task, process_single_file)

    task_group = group(
        task.s(path, job_id)
        for path in file_paths
    )

    task_group.apply_async()

    return {
        "job_id": job_id,
        "message": f"Uploaded {len(files)} file(s) for processing",
        "total_files": len(files),
    }