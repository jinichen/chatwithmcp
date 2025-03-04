import logging
import logging.handlers
import json
import sys
from pathlib import Path
from typing import Any, Dict

from app.core.config import settings


class JSONFormatter(logging.Formatter):
    """Custom JSON formatter for structured logging"""
    def format(self, record: logging.LogRecord) -> str:
        log_obj: Dict[str, Any] = {
            "timestamp": self.formatTime(record),
            "level": record.levelname,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno
        }
        
        # Add extra fields if available
        if hasattr(record, "extra"):
            log_obj.update(record.extra)
        
        # Add exception info if available
        if record.exc_info:
            log_obj["exception"] = self.formatException(record.exc_info)
        
        return json.dumps(log_obj)


def setup_logging() -> logging.Logger:
    """Configure logging with both file and console handlers"""
    logger = logging.getLogger("app")
    logger.setLevel(getattr(logging, settings.LOG_LEVEL))
    
    # Create logs directory if it doesn't exist
    log_dir = Path("logs")
    log_dir.mkdir(exist_ok=True)
    
    # Configure console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(
        logging.Formatter(settings.LOG_FORMAT)
    )
    logger.addHandler(console_handler)
    
    # Configure JSON file handler
    if settings.LOG_FILE:
        file_handler = logging.handlers.RotatingFileHandler(
            log_dir / settings.LOG_FILE,
            maxBytes=10 * 1024 * 1024,  # 10MB
            backupCount=5
        )
        file_handler.setFormatter(JSONFormatter())
        logger.addHandler(file_handler)
    
    # Prevent propagation to root logger
    logger.propagate = False
    
    return logger


# Create logger instance
logger = setup_logging()


def log_request(request_id: str, method: str, path: str, status_code: int, duration: float) -> None:
    """Log HTTP request details"""
    logger.info(
        f"Request completed",
        extra={
            "request_id": request_id,
            "method": method,
            "path": path,
            "status_code": status_code,
            "duration": duration
        }
    )


def log_error(error: Exception, context: Dict[str, Any] = None) -> None:
    """Log error with context"""
    extra = {
        "error_type": type(error).__name__,
        "error_message": str(error)
    }
    if context:
        extra.update(context)
    
    logger.error(
        f"Error occurred: {str(error)}",
        extra=extra,
        exc_info=True
    )


def log_db_error(error: Exception, query: str = None) -> None:
    """Log database-specific errors"""
    context = {"query": query} if query else {}
    log_error(error, context)


def setup_logging() -> None:
    """Configure logging for third-party libraries"""
    # Set up SQLAlchemy logging
    logging.getLogger('sqlalchemy.engine').setLevel(logging.INFO)
    
    # Set up Uvicorn logging
    logging.getLogger("uvicorn.access").setLevel(logging.INFO)
    
    # Set up FastAPI logging
    logging.getLogger("fastapi").setLevel(logging.INFO) 