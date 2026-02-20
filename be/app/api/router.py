from fastapi import APIRouter

from app.api.routers import auth, catalog, characters, chat_session, companion, health, ingestion

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(catalog.router)
api_router.include_router(companion.router)
api_router.include_router(characters.router)
api_router.include_router(chat_session.router)
api_router.include_router(ingestion.router)
