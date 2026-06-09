FROM python:3.12-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DEBIAN_FRONTEND=noninteractive

WORKDIR /app

# Install system dependencies for OCR & general library building
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libgomp1 \
    poppler-utils \
    procps \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv package manager
RUN pip install --no-cache-dir uv

# Copy dependency configuration files
COPY pyproject.toml uv.lock ./

# Install python dependencies globally using uv
# Use --system because we don't need a virtualenv inside a container
RUN uv pip install --system --no-cache -r pyproject.toml

# Copy project files
COPY . .

# Create directory for uploads
RUN mkdir -p data/uploads

# Expose port
EXPOSE 8000

# Default command: launch the FastAPI application
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
