from fastapi import APIRouter

from app.api.areas import router as areas_router
from app.api.auth import router as auth_router
from app.api.habits import router as habits_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(areas_router)
api_router.include_router(habits_router)
