from typing import Any, List, Optional
from datetime import datetime, timedelta
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api import deps
from app.core.config import settings
from app.schemas.mcp import (
    MCP,
    MCPCreate,
    MCPUpdate,
    MCPWithStats,
    MCPInstallation,
    MCPInstallationCreate,
    MCPValidationResult,
)

router = APIRouter()


async def validate_mcp_connection(
    api_endpoint: str,
    api_key: str,
) -> MCPValidationResult:
    """Validate MCP connection and detect capabilities"""
    try:
        async with httpx.AsyncClient() as client:
            # Test connection with health check
            start_time = datetime.utcnow()
            response = await client.get(
                f"{api_endpoint}/health",
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=10.0
            )
            latency = (datetime.utcnow() - start_time).total_seconds() * 1000
            
            if response.status_code != 200:
                return MCPValidationResult(
                    is_valid=False,
                    error_message=f"Health check failed: {response.status_code}",
                    latency=latency
                )
            
            # Get models and capabilities
            models_response = await client.get(
                f"{api_endpoint}/models",
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=10.0
            )
            
            if models_response.status_code != 200:
                return MCPValidationResult(
                    is_valid=False,
                    error_message="Failed to fetch models",
                    latency=latency
                )
            
            models_data = models_response.json()
            return MCPValidationResult(
                is_valid=True,
                detected_models=models_data.get("models", []),
                detected_capabilities=models_data.get("capabilities", []),
                latency=latency
            )
            
    except Exception as e:
        return MCPValidationResult(
            is_valid=False,
            error_message=str(e),
            latency=0.0
        )


@router.get("/mcps", response_model=List[MCP])
def list_mcps(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_active_user),
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    capability: Optional[str] = None,
    model_id: Optional[str] = None,
) -> Any:
    """
    Retrieve MCPs with optional filtering.
    """
    mcps, _ = crud.mcp.get_multi_with_filters(
        db,
        skip=skip,
        limit=limit,
        status=status,
        capability=capability,
        model_id=model_id
    )
    return mcps


@router.post("/mcps", response_model=MCP)
async def create_mcp(
    *,
    db: Session = Depends(deps.get_db),
    mcp_in: MCPCreate,
    current_user: models.User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Create new MCP.
    Only superusers can register new MCPs.
    """
    # Check if MCP with same name exists
    if crud.mcp.get_by_name(db, name=mcp_in.name):
        raise HTTPException(
            status_code=400,
            detail="MCP with this name already exists"
        )
    
    # Validate MCP connection
    validation = await validate_mcp_connection(
        api_endpoint=str(mcp_in.api_endpoint),
        api_key=mcp_in.api_key
    )
    
    if not validation.is_valid:
        raise HTTPException(
            status_code=400,
            detail=f"MCP validation failed: {validation.error_message}"
        )
    
    # Create MCP
    mcp = crud.mcp.create(db, obj_in=mcp_in)
    return mcp


@router.get("/mcps/{mcp_id}", response_model=MCPWithStats)
def get_mcp(
    *,
    db: Session = Depends(deps.get_db),
    mcp_id: int,
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get MCP by ID with usage statistics.
    """
    mcp = crud.mcp.get(db, id=mcp_id)
    if not mcp:
        raise HTTPException(status_code=404, detail="MCP not found")
    
    # Get statistics
    stats = crud.mcp.get_mcp_stats(db, mcp_id=mcp_id)
    
    return {
        **mcp.__dict__,
        **stats
    }


@router.put("/mcps/{mcp_id}", response_model=MCP)
async def update_mcp(
    *,
    db: Session = Depends(deps.get_db),
    mcp_id: int,
    mcp_in: MCPUpdate,
    current_user: models.User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Update MCP.
    Only superusers can update MCPs.
    """
    mcp = crud.mcp.get(db, id=mcp_id)
    if not mcp:
        raise HTTPException(status_code=404, detail="MCP not found")
    
    # If API endpoint or key is updated, validate connection
    if mcp_in.api_endpoint or mcp_in.api_key:
        validation = await validate_mcp_connection(
            api_endpoint=str(mcp_in.api_endpoint or mcp.api_endpoint),
            api_key=mcp_in.api_key or mcp.api_key
        )
        
        if not validation.is_valid:
            raise HTTPException(
                status_code=400,
                detail=f"MCP validation failed: {validation.error_message}"
            )
    
    mcp = crud.mcp.update(db, db_obj=mcp, obj_in=mcp_in)
    return mcp


@router.delete("/mcps/{mcp_id}")
def delete_mcp(
    *,
    db: Session = Depends(deps.get_db),
    mcp_id: int,
    current_user: models.User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Delete MCP.
    Only superusers can delete MCPs.
    """
    mcp = crud.mcp.get(db, id=mcp_id)
    if not mcp:
        raise HTTPException(status_code=404, detail="MCP not found")
    
    # Check if MCP has active installations
    if mcp.installation_count > 0:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete MCP with active installations"
        )
    
    crud.mcp.remove(db, id=mcp_id)
    return {"status": "success"}


@router.get("/users/me/mcps", response_model=List[MCPInstallation])
def list_user_mcps(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_active_user),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    List MCPs installed by current user.
    """
    installations, _ = crud.mcp_installation.get_multi_by_user(
        db,
        user_id=current_user.id,
        skip=skip,
        limit=limit
    )
    return installations


@router.post("/users/me/mcps", response_model=MCPInstallation)
def install_mcp(
    *,
    db: Session = Depends(deps.get_db),
    installation_in: MCPInstallationCreate,
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Install MCP for current user.
    """
    # Check if MCP exists and is active
    mcp = crud.mcp.get(db, id=installation_in.mcp_id)
    if not mcp:
        raise HTTPException(status_code=404, detail="MCP not found")
    if mcp.status != "active":
        raise HTTPException(
            status_code=400,
            detail=f"MCP is not active (status: {mcp.status})"
        )
    
    # Check if already installed
    if crud.mcp_installation.get(
        db,
        user_id=current_user.id,
        mcp_id=installation_in.mcp_id
    ):
        raise HTTPException(
            status_code=400,
            detail="MCP is already installed"
        )
    
    installation = crud.mcp_installation.create(
        db,
        obj_in=installation_in,
        user_id=current_user.id
    )
    return installation


@router.delete("/users/me/mcps/{mcp_id}")
def uninstall_mcp(
    *,
    db: Session = Depends(deps.get_db),
    mcp_id: int,
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Uninstall MCP for current user.
    """
    installation = crud.mcp_installation.remove(
        db,
        user_id=current_user.id,
        mcp_id=mcp_id
    )
    if not installation:
        raise HTTPException(
            status_code=404,
            detail="MCP installation not found"
        )
    return {"status": "success"}


@router.post("/mcps/validate")
async def validate_mcp(
    *,
    api_endpoint: str = Query(..., description="MCP API endpoint"),
    api_key: str = Query(..., description="MCP API key"),
    current_user: models.User = Depends(deps.get_current_active_superuser),
) -> MCPValidationResult:
    """
    Validate MCP connection and detect capabilities.
    Only superusers can validate MCPs.
    """
    return await validate_mcp_connection(api_endpoint, api_key) 