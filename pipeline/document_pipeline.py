from extraction.extractor import extract_text
from processing.cleaner import clean_text
from processing.chunker import chunk_text

def run_ocr_pipeline(filepath):
    raw = extract_text(filepath)
    clean = clean_text(raw)
    chunks = chunk_text(clean)

    return {
        "clean_text": clean,
        "chunks": chunks
    }