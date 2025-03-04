from datetime import datetime
from typing import Dict, List
from sqlalchemy import Boolean, Column, Integer, String, DateTime, ForeignKey, JSON, Float, func
from sqlalchemy.orm import relationship

from app.db.base_class import Base
from app.models.user import User


class MCP(Base):
    __tablename__ = "mcps"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String)
    api_endpoint = Column(String, nullable=False)
    api_key = Column(String, nullable=False)
    supported_models = Column(JSON, nullable=False)
    capabilities = Column(JSON, nullable=False)
    rate_limit = Column(Integer)
    status = Column(String, nullable=False, default="active")
    admin_email = Column(String)
    
    # Statistics
    installation_count = Column(Integer, default=0)
    total_requests = Column(Integer, default=0)
    average_latency = Column(Float, default=0.0)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    installations = relationship("MCPInstallation", back_populates="mcp")
    usage_logs = relationship("MCPUsageLog", back_populates="mcp")


class MCPInstallation(Base):
    __tablename__ = "mcp_installations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    mcp_id = Column(Integer, ForeignKey("mcps.id"), nullable=False)
    settings = Column(JSON)
    request_count = Column(Integer, default=0)
    last_used_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="mcp_installations")
    mcp = relationship("MCP", back_populates="installations")


class MCPUsageLog(Base):
    __tablename__ = "mcp_usage_logs"

    id = Column(Integer, primary_key=True, index=True)
    mcp_id = Column(Integer, ForeignKey("mcps.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    model_id = Column(String, nullable=False)
    request_type = Column(String, nullable=False)
    tokens_used = Column(Integer)
    latency = Column(Float)  # in milliseconds
    error = Column(Boolean, default=False)
    error_message = Column(String)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    mcp = relationship("MCP", back_populates="usage_logs")
    user = relationship("User", back_populates="mcp_usage_logs") 