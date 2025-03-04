from typing import Callable
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
import time
from datetime import datetime

from app.core.config import settings
from app.core.logging import logger


# Rate limiter configuration
limiter = Limiter(key_func=get_remote_address)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to responses"""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = "default-src 'self'"
        return response


class RequestValidationMiddleware(BaseHTTPMiddleware):
    """Validate and sanitize incoming requests"""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Log request details
        logger.info(
            "Request",
            extra={
                "path": request.url.path,
                "method": request.method,
                "client": request.client.host if request.client else None,
                "timestamp": datetime.utcnow().isoformat(),
            }
        )
        
        # Validate content length
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > settings.MAX_CONTENT_LENGTH:
            return Response(
                status_code=413,
                content={"detail": "Request too large"}
            )
        
        # Validate content type for POST/PUT requests
        if request.method in ["POST", "PUT"]:
            content_type = request.headers.get("content-type", "")
            if not content_type.startswith(("application/json", "multipart/form-data")):
                return Response(
                    status_code=415,
                    content={"detail": "Unsupported media type"}
                )
        
        try:
            response = await call_next(request)
            return response
        except Exception as e:
            logger.error(
                "Request error",
                extra={
                    "path": request.url.path,
                    "method": request.method,
                    "error": str(e),
                }
            )
            raise


class MetricsMiddleware(BaseHTTPMiddleware):
    """Collect request metrics"""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.time()
        
        response = await call_next(request)
        
        # Calculate request duration
        duration = time.time() - start_time
        
        # Log metrics
        logger.info(
            "Request metrics",
            extra={
                "path": request.url.path,
                "method": request.method,
                "status_code": response.status_code,
                "duration": duration,
                "timestamp": datetime.utcnow().isoformat(),
            }
        )
        
        return response


def setup_security_middleware(app: FastAPI) -> None:
    """Configure all security middleware"""
    
    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Add trusted host middleware
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=settings.ALLOWED_HOSTS,
    )
    
    # Add custom security middleware
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RequestValidationMiddleware)
    app.add_middleware(MetricsMiddleware)
    
    # Add rate limiting
    app.state.limiter = limiter 