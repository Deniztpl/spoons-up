from fastapi import APIRouter

from app.api.areas import router as areas_router
from app.api.auth import router as auth_router
from app.api.goals import goals_router, rules_router
from app.api.habits import router as habits_router
from app.api.today import router as today_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(areas_router)
api_router.include_router(habits_router)
api_router.include_router(goals_router)
api_router.include_router(rules_router)
api_router.include_router(today_router)
