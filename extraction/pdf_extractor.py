import os
import logging
import fitz
import numpy as np
from core.config import settings
from core.ocr_engine import ocr_image, _detect_language

logger = logging.getLogger(__name__)

def extract_from_pdf(file_path: str) -> str:
    abs_path = os.path.abspath(file_path)
    if not os.path.exists(abs_path):
        raise FileNotFoundError(f"File not found: {abs_path}")
        
    doc = fitz.open(abs_path)
    text_parts = []
    
    cached_lang = None
    
    for i, page in enumerate(doc):
        native_text = page.get_text()
        
        if len(native_text.strip()) >= 50:
            text_parts.append(native_text)
            
            if not cached_lang and len(native_text.strip()) >= 100:
                cached_lang = _detect_language(native_text)
                if cached_lang != "en":
                    logger.debug("Cached language '%s' from native text on page %d", cached_lang, i + 1)
        else:
            logger.info("Page %d has < 50 chars of native text. Falling back to PaddleOCR.", i + 1)
            
            pix = page.get_pixmap(dpi=settings.ocr_dpi, alpha=False, colorspace=fitz.csRGB)
            
            img_array = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w, 3)
                
            page_text = ocr_image(img_array, hint_lang=cached_lang, angle_cls=False)
            text_parts.append(page_text)
            
            if not cached_lang and len(page_text.strip()) >= 50:
                cached_lang = _detect_language(page_text)
                if cached_lang != "en":
                    logger.debug("Cached language '%s' from OCR text on page %d", cached_lang, i + 1)
            
            # Force immediate cleanup of heavy image data
            pix = None
            img_array = None
                
    doc.close()
    return "\n".join(part for part in text_parts if part)
