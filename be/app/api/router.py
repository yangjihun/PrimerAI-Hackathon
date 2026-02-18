from fastapi import APIRouter

from app.api.routers import auth, catalog, characters, companion, graph, health

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(catalog.router)
api_router.include_router(companion.router)
api_router.include_router(graph.router)
api_router.include_router(characters.router)
