import re
import logging

from core.config import settings

logger = logging.getLogger(__name__)

SECTION_PATTERNS = [
    r'(?:^|\n)\s*((?:Section|SECTION)\s+\d+[\.\d]*[^\n]*)',
    r'(?:^|\n)\s*((?:ARTICLE|Article)\s+[IVXLCDM\d]+[^\n]*)',
    r'(?:^|\n)\s*(\d+(?:\.\d+)*\.\s+[A-Z][^\n]*)',
    r'(?:^|\n)\s*([A-Z][A-Z\s,]{4,}(?:\.|:|\n))',
    r'(?:^|\n)\s*(\([a-z]\)\s+[^\n]*)',
    r'(?:^|\n)\s*(\([ivx]+\)\s+[^\n]*)',
]


def _detect_sections(text: str) -> list[dict]:
    """
    Split text into sections based on legal document heading patterns.
    Returns a list of {"title": ..., "content": ..., "start": ..., "end": ...}.
    """
    headings = []
    for pattern in SECTION_PATTERNS:
        for match in re.finditer(pattern, text):
            title = match.group(1).strip()
            if len(title) < 3 or title.replace('.', '').replace(' ', '').isdigit():
                continue
            headings.append({"title": title[:100], "start": match.start()})
    
    headings.sort(key=lambda x: x["start"])
    
    filtered = []
    for h in headings:
        if not filtered or h["start"] - filtered[-1]["start"] > 20:
            filtered.append(h)
    headings = filtered
    
    if not headings:
        return [{"title": "Document", "content": text, "start": 0, "end": len(text)}]
    
    sections = []
    
    if headings[0]["start"] > 50:
        sections.append({
            "title": "Preamble",
            "content": text[:headings[0]["start"]].strip(),
            "start": 0,
            "end": headings[0]["start"],
        })
    
    for i, heading in enumerate(headings):
        end = headings[i + 1]["start"] if i + 1 < len(headings) else len(text)
        content = text[heading["start"]:end].strip()
        if content:
            sections.append({
                "title": heading["title"],
                "content": content,
                "start": heading["start"],
                "end": end,
            })
    
    return sections


def _sub_chunk(text: str, max_chars: int = 800, overlap: int = 100) -> list[str]:
    """
    Split a long text block into overlapping sub-chunks at sentence boundaries.
    """
    if len(text) <= max_chars:
        return [text]
    
    sentences = re.split(r'(?<=[.!?;])\s+', text)
    
    chunks = []
    current_chunk = ""
    
    for sentence in sentences:
        if len(current_chunk) + len(sentence) <= max_chars:
            current_chunk += sentence + " "
        else:
            if current_chunk.strip():
                chunks.append(current_chunk.strip())
            if overlap > 0 and current_chunk:
                overlap_text = current_chunk[-overlap:].strip()
                current_chunk = overlap_text + " " + sentence + " "
            else:
                current_chunk = sentence + " "
    
    if current_chunk.strip():
        chunks.append(current_chunk.strip())
    
    return chunks


def chunk_text(text: str, max_chars: int | None = None, overlap: int | None = None) -> list[dict]:
    """
    Section-aware chunking for legal contracts.
    
    1. Detect section headings (Section X, ARTICLE, numbered clauses, ALL CAPS)
    2. Split at section boundaries
    3. Sub-chunk large sections with sentence-level overlap
    
    Returns: list of {"text": ..., "section_title": ..., "chunk_index": ...}
    """
    if not text or not text.strip():
        return []

    if max_chars is None:
        max_chars = settings.chunk_max_chars
    if overlap is None:
        overlap = settings.chunk_overlap

    sections = _detect_sections(text)
    logger.info(f"Detected {len(sections)} sections in document")
    
    chunks = []
    chunk_index = 0
    
    for section in sections:
        sub_chunks = _sub_chunk(section["content"], max_chars=max_chars, overlap=overlap)
        
        for sub in sub_chunks:
            if sub.strip():
                chunks.append({
                    "text": sub.strip(),
                    "section_title": section["title"],
                    "chunk_index": chunk_index,
                })
                chunk_index += 1
    
    logger.info(f"Created {len(chunks)} chunks from {len(sections)} sections")
    return chunks