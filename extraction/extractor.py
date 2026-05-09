import os
from extraction.pdf_extractor import extract_from_pdf
from extraction.image_extractor import extract_from_image
from extraction.docx_extractor import extract_from_docx

def extract_text(file_path: str) -> str:
    _, file_extension = os.path.splitext(file_path)
    file_extension = file_extension.lower()
    if file_extension == ".pdf":
        return extract_from_pdf(file_path)
    elif file_extension in (".png", ".jpg", ".jpeg"):
        return extract_from_image(file_path)
    elif file_extension == ".docx":
        return extract_from_docx(file_path)
    else:
        raise ValueError(f"Unsupported file extension: {file_extension}")
