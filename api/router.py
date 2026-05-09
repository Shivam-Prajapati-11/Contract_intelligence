from fastapi import APIRouter
from api.upload import router as upload_router
from api.status import router as status_router

router = APIRouter()
router.include_router(upload_router)
router.include_router(status_router)