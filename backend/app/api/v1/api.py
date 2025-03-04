from fastapi import APIRouter

from app.api.v1.endpoints import auth, conversation, users, mcp
from app.api.v1.endpoints import plugins

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(conversation.router, prefix="/conversations", tags=["conversations"])
api_router.include_router(mcp.router, prefix="/mcp", tags=["mcp"])
api_router.include_router(plugins.router, prefix="/plugins", tags=["plugins"])
api_router.include_router(conversation.models_router, prefix="/models", tags=["models"]) 