import uuid
from fastapi import APIRouter, UploadFile, File
from fastapi.responses import HTMLResponse
from typing import List, cast
from celery import group, Task

from ingestion.file_manager import save_file
from tasks.pipeline_tasks import process_single_file
from core.redis_client import redis_client

router = APIRouter()

@router.get("/", response_class=HTMLResponse)
async def serve_upload_form():
    return """
    <!DOCTYPE html>
    <html>
        <head>
            <title>Upload Files</title>
        </head>
        <body style="font-family: sans-serif; padding: 2rem;">
            <h2>Upload Documents for OCR</h2>
            <form action="/upload" method="post" enctype="multipart/form-data">
                <input type="file" name="files" multiple>
                <button type="submit">Upload</button>
            </form>
        </body>
    </html> 
    """

@router.post("/upload")
async def upload_files(files: List[UploadFile] = File(...)):
    job_id = str(uuid.uuid4())
    file_paths = []

    for file in files:
        content = await file.read()
        filename = f"{uuid.uuid4()}_{file.filename}"
        path = save_file(content, filename)
        file_paths.append(path)

    redis_client.delete(f"job:{job_id}:results")

    redis_client.hset(
        f"job:{job_id}",
        mapping={
            "status": "processing",
            "total_files": len(file_paths)
        }
    )

    task = cast(Task, process_single_file)

    task_group = group(
        task.s(path, job_id)
        for path in file_paths
    )

    task_group.apply_async()

    return {"job_id": job_id}