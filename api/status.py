from fastapi import APIRouter
from core.redis_client import redis_client

router = APIRouter()


@router.get("/status/{job_id}")
def get_status(job_id: str):
    meta_raw = redis_client.hgetall(f"job:{job_id}")
    results_raw = redis_client.lrange(f"job:{job_id}:results", 0, -1)
    
    import json
    meta = meta_raw if isinstance(meta_raw, dict) else {}
    results = [json.loads(r) for r in results_raw] if isinstance(results_raw, list) else []
    
    completed = len(results)
    total = int(meta.get("total_files", 0))

    status = (
        "not_found" if total == 0
        else "completed" if completed == total
        else "processing"
    )

    return {
        "status": status,
        "completed": completed,
        "total": total,
        "results": results
    }