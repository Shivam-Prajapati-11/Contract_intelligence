import io
import logging
from zipfile import ZipFile
import numpy as np
from docx import Document
from PIL import Image
from core.ocr_engine import ocr_image

logger = logging.getLogger(__name__)

_SUPPORTED_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".bmp", ".tiff", ".tif", ".gif"}


def _extract_embedded_images(file_path: str) -> list[np.ndarray]:
    """Extracts images from DOCX ZIP archive."""
    images: list[np.ndarray] = []
    try:
        with ZipFile(file_path, "r") as zf:
            media_files = [
                name for name in zf.namelist()
                if name.startswith("word/media/")
                and any(name.lower().endswith(ext) for ext in _SUPPORTED_IMAGE_EXTS)
            ]
            for path in media_files:
                try:
                    img = Image.open(io.BytesIO(zf.read(path))).convert("RGB")
                    images.append(np.array(img))
                except Exception as exc:
                    logger.warning("DOCX: skipping image '%s' — %s", path, exc)
    except Exception as exc:
        logger.warning("DOCX: image extraction failed — %s", exc)
    return images


def extract_from_docx(file_path: str) -> str:
    """Hybrid DOCX extraction: native text + OCR on images."""
    doc = Document(file_path)
    native_text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())

    embedded_images = _extract_embedded_images(file_path)
    image_texts: list[str] = []

    if embedded_images:
        logger.info("DOCX '%s': OCR-ing %d images", file_path, len(embedded_images))
        for idx, img_array in enumerate(embedded_images):
            try:
                text = ocr_image(img_array, hint_lang=None)
                if text.strip():
                    image_texts.append(text)
            except Exception as exc:
                logger.warning("DOCX: image %d OCR failed — %s", idx + 1, exc)

    return "\n".join(p for p in [native_text] + image_texts if p.strip())