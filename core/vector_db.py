import os
import logging
from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance

logger = logging.getLogger(__name__)

QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
COLLECTION_NAME = "contracts"
VECTOR_SIZE = 384  # all-MiniLM-L6-v2

client = QdrantClient(url=QDRANT_URL)

def _get_sbert_device() -> str:
    try:
        import torch
        return "cuda" if torch.cuda.is_available() else "cpu"
    except ImportError:
        return "cpu"


def init_db():
    try:
        if not client.collection_exists(collection_name=COLLECTION_NAME):
            client.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
            )
            logger.info(f"Created Qdrant collection: {COLLECTION_NAME}")
        else:
            logger.info(f"Qdrant collection {COLLECTION_NAME} already exists.")
    except Exception as e:
        logger.error(f"Failed to initialize Qdrant collection: {e}")
        raise

try:
    init_db()
except Exception as e:
    logger.critical(f"Could not initialize vector database. Exiting: {e}")
    raise SystemExit(1)


def insert_chunks(chunks_with_embeddings: list[dict], metadata: dict):
    """
    Insert chunks with embeddings and metadata into Qdrant.
    
    chunks_with_embeddings: List of dicts like:
        {"text": "...", "vector": [...], "section_title": "...", "chunk_index": 0}
    metadata: Dict with global metadata e.g. {"job_id": "...", "filename": "..."}
    """
    from qdrant_client.models import PointStruct
    import uuid

    points = []
    for chunk in chunks_with_embeddings:
        payload = metadata.copy()
        payload["text"] = chunk["text"]
        payload["section_title"] = chunk.get("section_title", "")
        payload["chunk_index"] = chunk.get("chunk_index", 0)
        
        point = PointStruct(
            id=str(uuid.uuid4()),
            vector=chunk["vector"],
            payload=payload
        )
        points.append(point)
    
    if points:
        batch_size = 100
        for i in range(0, len(points), batch_size):
            batch = points[i:i + batch_size]
            client.upsert(collection_name=COLLECTION_NAME, points=batch)
        logger.info(f"Inserted {len(points)} chunks into Qdrant for job {metadata.get('job_id')}")
        
    return True


_search_model = None

def _get_search_model():
    global _search_model
    if _search_model is None:
        from sentence_transformers import SentenceTransformer
        device = _get_sbert_device()
        logger.info("Initializing SentenceTransformer search model lazily on device=%s...", device)
        _search_model = SentenceTransformer("all-MiniLM-L6-v2", device=device)
    return _search_model


def search_chunks(job_id: str, query: str, top_k: int = 10) -> list[dict]:
    """
    Embeds the query and searches Qdrant for the most relevant chunks.
    Returns list of dicts with text, section_title, chunk_index, and score.
    """
    from qdrant_client.models import Filter, FieldCondition, MatchValue
    
    model = _get_search_model()
    if model is None:
        logger.error("Embedding model not available for search")
        return []
        
    query_vector = model.encode(query).tolist()
    
    query_filter = Filter(
        must=[
            FieldCondition(
                key="job_id",
                match=MatchValue(value=job_id)
            )
        ]
    )
    
    try:
        results = client.query_points(
            collection_name=COLLECTION_NAME,
            query=query_vector,
            query_filter=query_filter,
            limit=top_k,
            with_payload=True,
        )
        
        chunks = []
        for hit in results.points:
            chunks.append({
                "text": hit.payload.get("text", ""),
                "section_title": hit.payload.get("section_title", ""),
                "chunk_index": hit.payload.get("chunk_index", 0),
                "score": hit.score if hasattr(hit, 'score') else 0,
            })
        
        logger.warning(f"[SEARCH] job_id={job_id} | query='{query[:50]}...' | found {len(chunks)} chunks")
        if chunks:
            logger.warning(f"[SEARCH] Top chunk (section='{chunks[0]['section_title']}'): {chunks[0]['text'][:100]}...")
        else:
            logger.warning(f"[SEARCH] NO CHUNKS FOUND for job_id={job_id}")
        
        return chunks
    except Exception as e:
        logger.error(f"Error searching Qdrant: {e}")
        return []


def get_chunks_by_order(job_id: str, limit: int = 10) -> list[dict]:
    """
    Retrieve the first N chunks of a document sorted by chunk_index.
    
    IMPORTANT: Qdrant scroll returns points in arbitrary UUID order,
    so we must fetch ALL chunks and sort by chunk_index to get the 
    actual document-order preamble.
    """
    all_chunks = get_all_chunks(job_id)
    return all_chunks[:limit]


def get_all_chunks(job_id: str) -> list[dict]:
    """
    Retrieve ALL chunks for a document, sorted by chunk_index (document order).
    Used for comprehensive text analysis and preamble extraction.
    """
    from qdrant_client.models import Filter, FieldCondition, MatchValue
    
    try:
        query_filter = Filter(
            must=[FieldCondition(key="job_id", match=MatchValue(value=job_id))]
        )
        
        all_points = []
        offset = None
        
        while True:
            results, next_offset = client.scroll(
                collection_name=COLLECTION_NAME,
                scroll_filter=query_filter,
                limit=100,
                offset=offset,
            )
            all_points.extend(results)
            
            if next_offset is None:
                break
            offset = next_offset
        
        chunks = []
        for point in all_points:
            chunks.append({
                "text": point.payload.get("text", ""),
                "section_title": point.payload.get("section_title", ""),
                "chunk_index": point.payload.get("chunk_index", 0),
            })
        
        # Sort by chunk_index to get true document order
        chunks.sort(key=lambda x: x["chunk_index"])
        
        logger.info(f"Retrieved {len(chunks)} total chunks for job {job_id}")
        return chunks
    except Exception as e:
        logger.warning(f"Could not retrieve ordered chunks: {e}")
        return []


def keyword_search_chunks(job_id: str, keywords: list[str], limit: int = 10) -> list[dict]:
    """
    Retrieve chunks for a given job_id that match any of the provided keywords.
    Uses Qdrant scroll + in-memory keyword matching (since Qdrant's full-text filter
    requires a payload index, this approach is simpler and more portable).
    
    Returns up to `limit` chunks sorted by keyword match density (most matches first).
    """
    from qdrant_client.models import Filter, FieldCondition, MatchValue
    
    try:
        query_filter = Filter(
            must=[FieldCondition(key="job_id", match=MatchValue(value=job_id))]
        )
        
        all_points = []
        offset = None
        
        while True:
            results, next_offset = client.scroll(
                collection_name=COLLECTION_NAME,
                scroll_filter=query_filter,
                limit=100,
                offset=offset,
            )
            all_points.extend(results)
            
            if next_offset is None:
                break
            offset = next_offset
        
        scored_chunks = []
        for point in all_points:
            text = (point.payload.get("text", "") or "").lower()
            score = 0
            for kw in keywords:
                kw_lower = kw.lower()
                count = text.count(kw_lower)
                score += count
            
            if score > 0:
                scored_chunks.append({
                    "text": point.payload.get("text", ""),
                    "section_title": point.payload.get("section_title", ""),
                    "chunk_index": point.payload.get("chunk_index", 0),
                    "score": score,
                })
        
        # Sort by keyword match count descending, then by chunk_index ascending
        scored_chunks.sort(key=lambda x: (-x["score"], x["chunk_index"]))
        
        # Return only top `limit` results without the internal score
        result = scored_chunks[:limit]
        for chunk in result:
            chunk.pop("score", None)
        
        logger.info(f"Keyword search: job_id={job_id} | keywords={keywords} | found {len(result)} matching chunks")
        return result
    except Exception as e:
        logger.warning(f"Could not perform keyword search: {e}")
        return []