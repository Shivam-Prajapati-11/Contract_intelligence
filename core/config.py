from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Centralized configuration for the Contract Intelligence Platform."""

    # --- App ---
    app_name: str = "Contract Intelligence Platform"
    app_version: str = "2.0.0"
    debug: bool = False

    # --- Redis ---
    redis_url: str = Field(default="redis://localhost:6379/0")

    # --- Qdrant ---
    qdrant_url: str = Field(default="http://localhost:6333")
    collection_name: str = "contracts"
    vector_size: int = 384  # all-MiniLM-L6-v2

    # --- Ollama ---
    ollama_url: str = Field(default="http://127.0.0.1:11434/api/generate")
    ollama_model: str = "qwen2.5:7b"
    ollama_temperature: float = 0.0
    ollama_max_tokens: int = 1024
    ollama_timeout: int = 120
    ollama_num_ctx: int = 4096
    ollama_seed: int = 42

    # --- Embedding ---
    embedding_model: str = "all-MiniLM-L6-v2"
    embedding_device: str = "cpu"  # "cpu", "cuda", or "auto"

    # --- OCR ---
    ocr_use_gpu: bool = True  # True: Enable GPU auto-detection (falls back to CPU if no GPU/CUDA is available)
    ocr_gpu_id: int = 0
    ocr_gpu_mem: int = 500  # MB to preallocate (only used if use_gpu=True)
    ocr_cpu_threads: int = 4  # Number of CPU threads to use for OCR inference
    ocr_enable_mkldnn: bool = True  # Enable Intel MKL-DNN CPU acceleration
    ocr_dpi: int = 300  # DPI resolution to render PDF pages (e.g., 150/200 for low-spec, 300 for high quality)

    # --- Chunking ---
    chunk_max_chars: int = 1200
    chunk_overlap: int = 200

    # --- Retrieval ---
    search_top_k: int = 15
    max_context_chars: int = 12000
    preamble_chunks: int = 10

    # --- Upload ---
    max_file_size_mb: int = 50
    allowed_extensions: list[str] = [".pdf", ".docx", ".png", ".jpg", ".jpeg"]
    upload_dir: str = "data/uploads"

    # --- QA ---
    confidence_high: float = 6.0
    confidence_low: float = 3.0

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
