from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.engine import Engine
from sqlalchemy.pool import QueuePool
from sqlalchemy.ext.declarative import declarative_base
import time
import logging

from app.core.config import settings
from app.core.logging import logger


# Convert PostgresDsn to string for SQLAlchemy
database_url = str(settings.SQLALCHEMY_DATABASE_URI)

# Configure engine with connection pooling
engine = create_engine(
    database_url,
    poolclass=QueuePool,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_timeout=settings.DB_POOL_TIMEOUT,
    pool_pre_ping=True,
    pool_recycle=settings.DB_POOL_RECYCLE,
    echo=settings.DB_ECHO_SQL,
)

# Configure session with performance optimizations
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False  # Prevent unnecessary DB hits
)

Base = declarative_base()


# Query timing logging
@event.listens_for(Engine, "before_cursor_execute")
def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    conn.info.setdefault('query_start_time', []).append(time.time())


@event.listens_for(Engine, "after_cursor_execute")
def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    total = time.time() - conn.info['query_start_time'].pop()
    
    # Log slow queries
    if total > settings.SLOW_QUERY_THRESHOLD:
        logger.warning(
            "Slow query detected",
            extra={
                "duration": total,
                "statement": statement,
                "parameters": parameters
            }
        )


def get_db() -> Session:
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def optimize_query(query, db: Session):
    """Apply query optimizations"""
    # Enable eager loading for relationships
    query = query.enable_eagerloads(True)
    
    # Add query execution plan logging in development
    if settings.ENVIRONMENT == "development":
        plan = db.execute(f"EXPLAIN ANALYZE {query}").fetchall()
        logger.debug("Query plan", extra={"plan": plan})
    
    return query


class DBStats:
    """Track database statistics"""
    def __init__(self):
        self.total_connections = 0
        self.active_connections = 0
        self.total_queries = 0
        self.slow_queries = 0
        self.errors = 0

    def get_stats(self) -> dict:
        return {
            "total_connections": self.total_connections,
            "active_connections": self.active_connections,
            "total_queries": self.total_queries,
            "slow_queries": self.slow_queries,
            "errors": self.errors,
            "pool": {
                "size": engine.pool.size(),
                "checked_in": engine.pool.checkedin(),
                "checked_out": engine.pool.checkedout(),
                "overflow": engine.pool.overflow()
            }
        }


db_stats = DBStats()


@event.listens_for(Engine, "connect")
def receive_connect(dbapi_connection, connection_record):
    db_stats.total_connections += 1
    db_stats.active_connections += 1


@event.listens_for(Engine, "close")
def receive_close(dbapi_connection, connection_record):
    db_stats.active_connections -= 1 