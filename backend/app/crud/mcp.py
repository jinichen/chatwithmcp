from typing import Dict, List, Optional, Tuple, Union
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from fastapi.encoders import jsonable_encoder

from app.crud.base import CRUDBase
from app.models.mcp import MCP, MCPInstallation, MCPUsageLog
from app.schemas.mcp import MCPCreate, MCPUpdate, MCPInstallationCreate, MCPInstallationUpdate


class CRUDMcp(CRUDBase[MCP, MCPCreate, MCPUpdate]):
    def get_by_name(self, db: Session, *, name: str) -> Optional[MCP]:
        return db.query(MCP).filter(MCP.name == name).first()

    def get_multi_with_filters(
        self,
        db: Session,
        *,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        capability: Optional[str] = None,
        model_id: Optional[str] = None
    ) -> Tuple[List[MCP], int]:
        query = db.query(MCP)
        
        if status:
            query = query.filter(MCP.status == status)
        if capability:
            query = query.filter(MCP.capabilities.contains([capability]))
        if model_id:
            query = query.filter(MCP.supported_models.contains([{"id": model_id}]))
        
        total = query.count()
        mcps = query.offset(skip).limit(limit).all()
        
        return mcps, total

    def get_mcp_stats(
        self,
        db: Session,
        *,
        mcp_id: int,
        days: int = 30
    ) -> Dict:
        # Get date range
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Get daily requests
        daily_requests = (
            db.query(
                func.date_trunc('day', MCPUsageLog.timestamp).label('date'),
                func.count(MCPUsageLog.id).label('count')
            )
            .filter(
                MCPUsageLog.mcp_id == mcp_id,
                MCPUsageLog.timestamp >= start_date
            )
            .group_by('date')
            .all()
        )
        
        # Get error rate
        total_requests = (
            db.query(func.count(MCPUsageLog.id))
            .filter(MCPUsageLog.mcp_id == mcp_id)
            .scalar()
        )
        error_requests = (
            db.query(func.count(MCPUsageLog.id))
            .filter(
                MCPUsageLog.mcp_id == mcp_id,
                MCPUsageLog.error == True
            )
            .scalar()
        )
        error_rate = error_requests / total_requests if total_requests > 0 else 0
        
        # Get average tokens per request
        avg_tokens = (
            db.query(func.avg(MCPUsageLog.tokens_used))
            .filter(MCPUsageLog.mcp_id == mcp_id)
            .scalar() or 0
        )
        
        return {
            "daily_requests": {str(d.date): d.count for d in daily_requests},
            "error_rate": error_rate,
            "average_tokens_per_request": float(avg_tokens)
        }

    def update_mcp_stats(
        self,
        db: Session,
        *,
        mcp_id: int,
        tokens_used: Optional[int] = None,
        latency: Optional[float] = None,
        error: bool = False
    ) -> None:
        mcp = db.query(MCP).filter(MCP.id == mcp_id).first()
        if mcp:
            mcp.total_requests += 1
            if latency:
                # Update running average
                mcp.average_latency = (
                    (mcp.average_latency * (mcp.total_requests - 1) + latency)
                    / mcp.total_requests
                )
            db.commit()


class CRUDMcpInstallation:
    def get(
        self,
        db: Session,
        *,
        user_id: int,
        mcp_id: int
    ) -> Optional[MCPInstallation]:
        return (
            db.query(MCPInstallation)
            .filter(
                MCPInstallation.user_id == user_id,
                MCPInstallation.mcp_id == mcp_id
            )
            .first()
        )

    def get_multi_by_user(
        self,
        db: Session,
        *,
        user_id: int,
        skip: int = 0,
        limit: int = 100
    ) -> Tuple[List[MCPInstallation], int]:
        query = db.query(MCPInstallation).filter(MCPInstallation.user_id == user_id)
        total = query.count()
        installations = query.offset(skip).limit(limit).all()
        return installations, total

    def create(
        self,
        db: Session,
        *,
        obj_in: MCPInstallationCreate,
        user_id: int
    ) -> MCPInstallation:
        obj_in_data = jsonable_encoder(obj_in)
        db_obj = MCPInstallation(**obj_in_data, user_id=user_id)
        db.add(db_obj)
        
        # Update MCP installation count
        mcp = db.query(MCP).filter(MCP.id == obj_in.mcp_id).first()
        if mcp:
            mcp.installation_count += 1
        
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(
        self,
        db: Session,
        *,
        db_obj: MCPInstallation,
        obj_in: Union[MCPInstallationUpdate, Dict[str, any]]
    ) -> MCPInstallation:
        obj_data = jsonable_encoder(db_obj)
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.model_dump(exclude_unset=True)
        for field in obj_data:
            if field in update_data:
                setattr(db_obj, field, update_data[field])
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def remove(
        self,
        db: Session,
        *,
        user_id: int,
        mcp_id: int
    ) -> Optional[MCPInstallation]:
        obj = self.get(db, user_id=user_id, mcp_id=mcp_id)
        if obj:
            db.delete(obj)
            
            # Update MCP installation count
            mcp = db.query(MCP).filter(MCP.id == mcp_id).first()
            if mcp and mcp.installation_count > 0:
                mcp.installation_count -= 1
            
            db.commit()
        return obj


class CRUDMcpUsageLog:
    def create(
        self,
        db: Session,
        *,
        mcp_id: int,
        user_id: int,
        model_id: str,
        request_type: str,
        tokens_used: Optional[int] = None,
        latency: Optional[float] = None,
        error: bool = False,
        error_message: Optional[str] = None
    ) -> MCPUsageLog:
        db_obj = MCPUsageLog(
            mcp_id=mcp_id,
            user_id=user_id,
            model_id=model_id,
            request_type=request_type,
            tokens_used=tokens_used,
            latency=latency,
            error=error,
            error_message=error_message
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def get_user_usage(
        self,
        db: Session,
        *,
        user_id: int,
        mcp_id: Optional[int] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[MCPUsageLog]:
        query = db.query(MCPUsageLog).filter(MCPUsageLog.user_id == user_id)
        
        if mcp_id:
            query = query.filter(MCPUsageLog.mcp_id == mcp_id)
        if start_date:
            query = query.filter(MCPUsageLog.timestamp >= start_date)
        if end_date:
            query = query.filter(MCPUsageLog.timestamp <= end_date)
        
        return query.all()


mcp = CRUDMcp(MCP)
mcp_installation = CRUDMcpInstallation()
mcp_usage = CRUDMcpUsageLog() 