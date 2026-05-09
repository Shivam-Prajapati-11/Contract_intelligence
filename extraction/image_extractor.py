from PIL import Image
import pytesseract
import shutil

tesseract = shutil.which("tesseract")
if tesseract:
    pytesseract.pytesseract.tesseract_cmd = tesseract

def extract_from_image(file_path: str) -> str:
    img = Image.open(file_path)
    return pytesseract.image_to_string(img)