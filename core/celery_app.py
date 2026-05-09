from celery import Celery

celery_app = Celery(
    "ocr_worker",
    broker = "redis://localhost:6379/0",
    backend = "redis://localhost:6379/0",
    include = ["tasks.pipeline_tasks"]
)

celery_app.conf.update(
    task_time_limit=3600,       # 1 hour hard time limit per task
    task_soft_time_limit=3300,  # 55 min soft time limit (triggers SoftTimeLimitExceeded)
)

