import json
from core.celery_app import celery_app
from pipeline.document_pipeline import run_ocr_pipeline
from core.redis_client import redis_client

@celery_app.task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={"max_retries": 3})
def process_single_file(self, file_path, job_id):
    """Celery task to process a single file through the OCR pipeline."""
    try:
        result = run_ocr_pipeline(file_path)
        redis_client.rpush(
            f"job:{job_id}:results",
            json.dumps({"file": file_path, "result": result})
        )
    except Exception as e:
        redis_client.rpush(
            f"job:{job_id}:results",
            json.dumps({"file": file_path, "error": str(e)})
        )
        raise e