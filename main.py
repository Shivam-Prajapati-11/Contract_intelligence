import os
os.environ["CUDA_VISIBLE_DEVICES"] = "-1"     # Keep PyTorch off GPU — Ollama owns VRAM exclusively
os.environ["TRANSFORMERS_OFFLINE"] = "1"      # Use cached HF model — skip 30s network checks that race with Ollama's VRAM load
os.environ["HF_DATASETS_OFFLINE"] = "1"       # Same — prevent huggingface_hub background polling
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from api.router import router
from core.config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    import asyncio, requests as _req
    logger.info(f"Starting {settings.app_name} v{settings.app_version}")
    logger.info(f"Ollama model: {settings.ollama_model}")
    logger.info(f"Qdrant: {settings.qdrant_url}")

    # Step 1: Pre-load the SentenceTransformer on CPU first (before Ollama loads its model).
    # This prevents the TDR crash where both load simultaneously and the GPU scheduler
    # resets due to unresponsiveness, killing Ollama's CUDA context.
    try:
        logger.info("Pre-loading SentenceTransformer embedding model on CPU...")
        from core.vector_db import _get_search_model
        await asyncio.to_thread(_get_search_model)
        logger.info("SentenceTransformer ready.")
    except Exception as e:
        logger.warning(f"Embedding model pre-load failed (non-fatal): {e}")

    # Step 2: Warm up Ollama — send a tiny generate request so qwen2.5:7b is already
    # loaded in VRAM when the first analyze request arrives (avoids cold-start race).
    try:
        logger.info(f"Warming up Ollama ({settings.ollama_model})...")
        warmup = await asyncio.to_thread(
            lambda: _req.post(
                settings.ollama_url,
                json={"model": settings.ollama_model, "prompt": "OK", "stream": False,
                      "options": {"num_predict": 1, "num_ctx": settings.ollama_num_ctx}},
                timeout=120,
            )
        )
        if warmup.status_code == 200:
            logger.info("Ollama warmed up — model loaded in VRAM.")
        else:
            logger.warning(f"Ollama warmup returned {warmup.status_code}")
    except Exception as e:
        logger.warning(f"Ollama warmup failed (non-fatal, will retry on first request): {e}")

    yield
    logger.info("Shutting down...")



app = FastAPI(
    title=settings.app_name,
    description="AI-powered legal contract analysis platform using RAG + LLM for clause extraction, risk scoring, and compliance checking.",
    version=settings.app_version,
    lifespan=lifespan,
)


@app.get("/")
def root():
        """Serve the browser upload form at the root URL."""
        return HTMLResponse(
                content="""
                <!doctype html>
                <html lang="en">
                <head>
                    <meta charset="utf-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1" />
                    <title>Contract Intelligence Upload</title>
                    <style>
                        body { font-family: Arial, sans-serif; background: #f6f8fc; margin: 0; padding: 40px; color: #102030; }
                        .card { max-width: 720px; margin: 0 auto; background: white; border-radius: 16px; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,.08); }
                        h1 { margin-top: 0; }
                        form { display: grid; gap: 16px; }
                        input[type=file] { padding: 12px; border: 1px solid #c8d0dc; border-radius: 10px; background: #fff; }
                        button { padding: 12px 18px; border: 0; border-radius: 10px; background: #0f62fe; color: white; font-weight: 600; cursor: pointer; }
                        .meta { color: #5a6b7f; font-size: 14px; }
                        .links a { color: #0f62fe; text-decoration: none; margin-right: 16px; }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <h1>Upload documents</h1>
                        <p class="meta">Upload PDF, DOCX, JPG, JPEG, or PNG files to extract and analyze contract text.</p>
                        <form action="/upload" method="post" enctype="multipart/form-data">
                            <input type="file" name="files" multiple accept=".pdf,.docx,.png,.jpg,.jpeg" />
                            <button type="submit">Upload</button>
                        </form>
                        <p class="links">
                            <a href="/docs">API Docs</a>
                            <a href="/health">Health Check</a>
                        </p>
                    </div>
                </body>
                </html>
                """
        )

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch all unhandled exceptions and return structured JSON."""
    logger.error(f"Unhandled error on {request.method} {request.url}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": str(exc)},
    )


@app.get("/health")
def health_check():
    """Health check endpoint for load balancers and monitoring."""
    services = {}
    
    # Check Redis
    try:
        from core.redis_client import redis_client
        redis_client.ping()
        services["redis"] = "healthy"
    except Exception:
        services["redis"] = "unhealthy"
    
    # Check Qdrant
    try:
        from core.vector_db import client
        client.get_collections()
        services["qdrant"] = "healthy"
    except Exception:
        services["qdrant"] = "unhealthy"
    
    # Check Ollama
    try:
        import requests
        resp = requests.get("http://localhost:11434/api/tags", timeout=3)
        if resp.status_code == 200:
            services["ollama"] = "healthy"
        else:
            services["ollama"] = "unhealthy"
    except Exception:
        services["ollama"] = "unhealthy"
    
    overall = "healthy" if all(v == "healthy" for v in services.values()) else "degraded"
    
    return {
        "status": overall,
        "version": settings.app_version,
        "services": services,
    }


app.include_router(router)