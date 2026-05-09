import os
import shutil
import platform
from pdf2image import convert_from_path
from PIL import Image, ImageEnhance, ImageFilter
import pytesseract
from concurrent.futures import ThreadPoolExecutor, as_completed

# Tesseract path setup
# Try PATH first, then fall back to standard Windows installation location
tesseract = shutil.which("tesseract")
if not tesseract and platform.system() == "Windows":
    tesseract = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    if not os.path.exists(tesseract):
        tesseract = r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe"

if tesseract and os.path.exists(tesseract):
    pytesseract.pytesseract.tesseract_cmd = tesseract

# Poppler path: prefer environment variable, else fall back to bundled poppler.
# Keep this independent of tesseract detection so POPPLER_PATH is always defined.
_default_poppler = os.path.join(
    os.path.dirname(__file__), "..", "poppler", "poppler-24.08.0", "Library", "bin"
)
POPPLER_PATH = os.environ.get("POPPLER_PATH") or _default_poppler

def preprocess_image(img: Image.Image) -> Image.Image:
    """Preprocess image for faster/better OCR"""
    # Enhance contrast
    enhancer = ImageEnhance.Contrast(img)
    img = enhancer.enhance(1.5)
    
    # Enhance sharpness
    enhancer = ImageEnhance.Sharpness(img)
    img = enhancer.enhance(1.2)
    
    return img

def extract_from_pdf(file_path: str) -> str:
    abs_path = os.path.abspath(file_path)
    if not os.path.exists(abs_path):
        raise FileNotFoundError(f"File not found: {abs_path}")
    
    # Convert PDF to images with optimized DPI for speed (300 DPI is a good balance)
    if platform.system() == "Windows" and POPPLER_PATH and os.path.exists(POPPLER_PATH):
        images = convert_from_path(abs_path, poppler_path=POPPLER_PATH, dpi=300, thread_count=4)
    else:
        images = convert_from_path(abs_path, dpi=300, thread_count=4)
    
    text_parts = [None] * len(images)
    
    def extract_and_preprocess(idx_img_pair):
        idx, img = idx_img_pair
        # Preprocess image for better OCR accuracy and speed
        img = preprocess_image(img)
        # Use faster PSM configs: PSM 3 for uniform block of text, PSM 6 for single uniform block
        text = pytesseract.image_to_string(img, config='--psm 6 --oem 1')
        return idx, text
    
    # Process pages in parallel with 4 workers
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {
            executor.submit(extract_and_preprocess, (idx, img)): idx
            for idx, img in enumerate(images)
        }
        
        for future in as_completed(futures):
            idx, text_chunk = future.result()
            text_parts[idx] = text_chunk
    
    text = "\n".join(part for part in text_parts if part)
    return text
