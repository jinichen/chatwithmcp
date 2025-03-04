from typing import Dict, List, Optional, Any
from datetime import datetime
from pydantic import BaseModel, HttpUrl, constr, validator
from enum import Enum


class MCPStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    MAINTENANCE = "maintenance"
    ERROR = "error"


class MCPCapability(str, Enum):
    CHAT = "chat"
    STREAMING = "streaming"
    FUNCTION_CALLING = "function_calling"
    CODE_GENERATION = "code_generation"
    IMAGE_GENERATION = "image_generation"


class MCPModelInfo(BaseModel):
    id: str
    name: str
    capabilities: List[MCPCapability]
    parameters: Dict[str, Dict]
    max_tokens: Optional[int] = None
    pricing: Optional[Dict[str, float]] = None


class MCPBase(BaseModel):
    name: str
    description: str
    api_endpoint: HttpUrl
    supported_models: List[MCPModelInfo]
    capabilities: List[MCPCapability]
    rate_limit: Optional[int] = None  # Requests per minute
    status: MCPStatus = MCPStatus.ACTIVE


class MCPCreate(MCPBase):
    api_key: constr(min_length=1)  # type: ignore
    admin_email: Optional[str] = None


class MCPUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    api_endpoint: Optional[HttpUrl] = None
    api_key: Optional[str] = None
    supported_models: Optional[List[MCPModelInfo]] = None
    capabilities: Optional[List[MCPCapability]] = None
    rate_limit: Optional[int] = None
    status: Optional[MCPStatus] = None
    admin_email: Optional[str] = None


class MCPInDBBase(MCPBase):
    id: int
    created_at: datetime
    updated_at: datetime
    installation_count: int = 0
    total_requests: int = 0
    average_latency: float = 0.0

    class Config:
        from_attributes = True


class MCP(MCPInDBBase):
    pass


class MCPWithStats(MCP):
    daily_requests: Dict[str, int]
    error_rate: float
    average_tokens_per_request: float


class MCPInstallationBase(BaseModel):
    mcp_id: int
    settings: Optional[Dict] = None


class MCPInstallationCreate(MCPInstallationBase):
    pass


class MCPInstallationUpdate(BaseModel):
    settings: Optional[Dict] = None


class MCPInstallation(MCPInstallationBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    last_used_at: Optional[datetime] = None
    request_count: int = 0

    class Config:
        from_attributes = True


class MCPValidationResult(BaseModel):
    is_valid: bool
    error_message: Optional[str] = None
    detected_models: Optional[List[MCPModelInfo]] = None
    detected_capabilities: Optional[List[MCPCapability]] = None
    latency: float


class MCPServerBase(BaseModel):
    name: str
    url: HttpUrl
    model: str
    metadata: Optional[Dict[str, Any]] = None


class MCPServerCreate(MCPServerBase):
    pass


class MCPServerUpdate(MCPServerBase):
    name: Optional[str] = None
    url: Optional[HttpUrl] = None
    model: Optional[str] = None


class MCPServer(MCPServerBase):
    id: str
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MCPServerInDB(MCPServer):
    pass


class MCPServerStats(BaseModel):
    total_requests: int = 0
    active_requests: int = 0
    average_response_time: float = 0.0
    uptime: float = 0.0
    memory_usage: float = 0.0
    cpu_usage: float = 0.0


class MCPServerHealth(BaseModel):
    status: str
    details: Dict[str, Any] 