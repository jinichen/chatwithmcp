import time
import uuid
from typing import Callable

from fastapi import FastAPI, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.types import ASGIApp

from app.core.logging import logger, log_request
from app.db.session import db_stats


class RequestTrackingMiddleware(BaseHTTPMiddleware):
    """Middleware for tracking request performance and logging"""
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)
    
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = str(uuid.uuid4())
        start_time = time.time()
        
        # Add request ID to request state
        request.state.request_id = request_id
        
        try:
            response = await call_next(request)
            
            # Calculate request duration
            duration = time.time() - start_time
            
            # Log request details
            log_request(
                request_id=request_id,
                method=request.method,
                path=request.url.path,
                status_code=response.status_code,
                duration=duration
            )
            
            # Add custom headers
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Response-Time"] = f"{duration:.3f}s"
            
            return response
            
        except Exception as e:
            logger.error(
                "Request failed",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "error": str(e)
                },
                exc_info=True
            )
            raise


class DatabaseStatsMiddleware(BaseHTTPMiddleware):
    """Middleware for tracking database statistics"""
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)
    
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)
        
        # Add database stats headers
        stats = db_stats.get_stats()
        response.headers["X-DB-Connections"] = str(stats["active_connections"])
        response.headers["X-DB-Pool-Size"] = str(stats["pool"]["size"])
        
        return response


def setup_middleware(app: FastAPI) -> None:
    """Setup all middleware for the application"""
    app.add_middleware(RequestTrackingMiddleware)
    app.add_middleware(DatabaseStatsMiddleware) 