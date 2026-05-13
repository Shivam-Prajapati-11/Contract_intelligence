from celery import Celery

celery_app = Celery(
    "ocr_worker",
    broker = "redis://localhost:6379/0",
    backend = "redis://localhost:6379/0",
    include = ["tasks.pipeline_tasks"]
)


celery_app.conf.update(
    worker_prefetch_multiplier=2,
    worker_max_tasks_per_child=100,
    task_time_limit=3600,
    task_soft_time_limit=3300,
)

