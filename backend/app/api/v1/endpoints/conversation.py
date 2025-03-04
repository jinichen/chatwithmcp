from typing import List, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse

from app import crud
from app.api import deps
from app.schemas.conversation import (
    Conversation,
    ConversationCreate,
    ConversationUpdate,
    ConversationPagination,
    Message,
    MessageCreate,
    MessagePagination,
    StreamResponse,
    ModelInfo
)
from app.models.user import User
from app.core.config import settings
from app.core.llm.chain import ConversationChain
from app.core.llm.streaming import StreamingCallbackHandler
from app.core.llm.providers import MODEL_CONFIGS

# 导入模块级函数以便直接使用
from app.crud.conversation import (
    get_conversation, 
    get_conversations,
    create_conversation, 
    update_conversation, 
    delete_conversation,
    get_messages,
    create_message
)

# Store active conversation chains
active_chains: Dict[int, ConversationChain] = {}

router = APIRouter()
# 创建一个单独的router用于模型API
models_router = APIRouter()

def get_conversation_chain(conversation_id: int, model_name: str, user_id: int = None) -> ConversationChain:
    """Get or create a conversation chain for the given conversation ID"""
    # If the chain exists but uses a different model, delete it and recreate
    if conversation_id in active_chains and active_chains[conversation_id].model_name != model_name:
        del active_chains[conversation_id]
        
    # Create a new chain if needed
    if conversation_id not in active_chains:
        # Get the model config to determine its name
        model_config = MODEL_CONFIGS.get(model_name, {})
        model_display_name = model_config.get("name", "AI")
        provider_name = model_config.get("provider", "")
        
        # Create a model-specific system prompt
        if provider_name and model_display_name:
            system_prompt = f"You are {model_display_name}, a helpful AI assistant by {provider_name}. Provide clear and concise responses."
        else:
            system_prompt = f"You are a helpful AI assistant. Provide clear and concise responses."
            
        active_chains[conversation_id] = ConversationChain(
            model_name=model_name,
            memory_size=10,
            system_prompt=system_prompt,
            user_id=user_id
        )
    return active_chains[conversation_id]


@router.get("/", response_model=ConversationPagination)
def list_conversations(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    page: int = 1,
    size: int = 10,
):
    """
    Retrieve conversations for the current user.
    """
    skip = (page - 1) * size
    items, total = get_conversations(
        db=db, user_id=current_user.id, skip=skip, limit=size
    )
    
    return {
        "total": total,
        "items": items,
        "page": page,
        "size": size
    }


@router.post("/", response_model=Conversation)
def create_conversations(
    *,
    db: Session = Depends(deps.get_db),
    conversation_in: ConversationCreate,
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Create new conversation.
    """
    conversation = create_conversation(
        db=db, conversation=conversation_in, user_id=current_user.id
    )
    return conversation


@router.get("/new")
def new_conversation(
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Get configuration for new conversation.
    """
    # 获取默认模型
    default_model = next(iter(MODEL_CONFIGS.keys()), "")
    
    return {
        "default_model": default_model,
        "available_models": [
            {
                "id": model_id,
                "name": config.get("name", model_id),
                "description": config.get("description", ""),
                "provider": config.get("provider", "Unknown")
            }
            for model_id, config in MODEL_CONFIGS.items()
        ]
    }


@router.get("/new/messages", response_model=MessagePagination)
def handle_new_messages(
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Special handler for /new/messages requests from frontend.
    Returns empty message list with instructions.
    """
    return {
        "total": 0,
        "items": [],
        "page": 1,
        "size": 0,
        "info": "这是新对话的初始状态。请点击'新建对话'按钮创建一个新的对话。"
    }


@router.get("/{conversation_id}", response_model=Conversation)
def get_conversation_by_id(
    conversation_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Get conversation by ID.
    """
    conversation = get_conversation(
        db=db, conversation_id=conversation_id, user_id=current_user.id
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


@router.put("/{conversation_id}", response_model=Conversation)
def update_conversation_by_id(
    *,
    db: Session = Depends(deps.get_db),
    conversation_id: int,
    conversation_in: ConversationUpdate,
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Update conversation.
    """
    conversation = get_conversation(
        db=db, conversation_id=conversation_id, user_id=current_user.id
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Check if the model is being updated
    if conversation_in.model and conversation_in.model != conversation.model:
        # If the model changed, remove the existing conversation chain
        if conversation_id in active_chains:
            del active_chains[conversation_id]
    
    conversation = update_conversation(
        db=db, conversation=conversation, update_data=conversation_in
    )
    return conversation


@router.delete("/{conversation_id}")
def delete_conversation_by_id(
    conversation_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Delete conversation.
    """
    conversation = get_conversation(
        db=db, conversation_id=conversation_id, user_id=current_user.id
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    delete_conversation(db=db, conversation=conversation)
    return {"status": "success"}


@router.get("/{conversation_id}/messages", response_model=MessagePagination)
def list_messages(
    conversation_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    page: int = 1,
    size: int = 50,
):
    """
    Retrieve messages for a conversation.
    """
    conversation = get_conversation(
        db=db, conversation_id=conversation_id, user_id=current_user.id
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    skip = (page - 1) * size
    items, total = get_messages(
        db=db, conversation_id=conversation_id, skip=skip, limit=size
    )
    return {
        "total": total,
        "items": items,
        "page": page,
        "size": size
    }


@router.post("/{conversation_id}/messages", response_model=Message)
async def create_user_message(
    *,
    db: Session = Depends(deps.get_db),
    conversation_id: int,
    message_in: MessageCreate,
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Create new message and get AI response.
    """
    conversation = get_conversation(
        db=db, conversation_id=conversation_id, user_id=current_user.id
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    # Create user message
    user_message = create_message(
        db=db, 
        message=message_in, 
        conversation_id=conversation_id
    )
    
    # Get AI response using the conversation chain
    chain = get_conversation_chain(conversation_id, conversation.model, current_user.id)
    ai_response = await chain.generate_response(message_in.content)
    
    # Create assistant message
    assistant_message = create_message(
        db=db,
        message=MessageCreate(content=ai_response),
        conversation_id=conversation_id
    )
    
    # Update conversation's updated_at timestamp
    update_conversation(
        db=db, 
        conversation=conversation,
        update_data=ConversationUpdate(updated_at=assistant_message.created_at)
    )
    
    return assistant_message


@router.post("/{conversation_id}/stream")
async def stream_response(
    request: Request,
    conversation_id: int,
    message_in: MessageCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Stream AI response for a new message.
    """
    conversation = get_conversation(
        db=db, conversation_id=conversation_id, user_id=current_user.id
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    # Create user message
    user_message = create_message(
        db=db, 
        message=message_in, 
        conversation_id=conversation_id
    )
    
    # Get conversation chain
    chain = get_conversation_chain(conversation_id, conversation.model, current_user.id)
    
    # Create a placeholder for the assistant message
    assistant_message = create_message(
        db=db,
        message=MessageCreate(content=""),
        conversation_id=conversation_id
    )
    
    # Update conversation's updated_at timestamp
    update_conversation(
        db=db, 
        conversation=conversation,
        update_data=ConversationUpdate(updated_at=assistant_message.created_at)
    )
    
    # Function to handle background task after streaming completes
    async def update_message_content(conversation_id: int, message_id: int, content: str):
        """Update message content in database after streaming is complete"""
        messages, _ = get_messages(db, conversation_id=conversation_id)
        if messages:
            for msg in messages:
                if msg.id == message_id:
                    msg.content = content
                    db.commit()
                    break
    
    # Stream response generator
    async def stream_generator():
        full_response = ""
        try:
            async for chunk in chain.astream_response(message_in.content):
                if chunk:
                    full_response += chunk
                    # Send the chunk directly
                    yield chunk.encode('utf-8')
                    
            # Schedule task to update the message content after streaming completes
            background_tasks = BackgroundTasks()
            background_tasks.add_task(
                update_message_content, 
                conversation_id=conversation_id,
                message_id=assistant_message.id,
                content=full_response
            )
                
        except Exception as e:
            error_msg = f"Error generating response: {str(e)}"
            yield error_msg.encode('utf-8')
            print(f"Error in stream_response: {error_msg}")
    
    # Return streaming response
    return StreamingResponse(
        stream_generator(),
        media_type="text/plain"
    )


@router.get("/models", response_model=List[ModelInfo])
def list_models(
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    List available AI models.
    """
    models = []
    for model_id, config in MODEL_CONFIGS.items():
        models.append(ModelInfo(
            id=model_id,
            name=config.get("name", model_id),
            description=config.get("description", ""),
            provider=config.get("provider", "Unknown")
        ))
    return models


@router.put("/{conversation_id}/model", response_model=Conversation)
def update_conversation_model(
    *,
    db: Session = Depends(deps.get_db),
    conversation_id: int,
    model_in: Dict[str, str],
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Update conversation model and reset the conversation chain.
    """
    conversation = get_conversation(
        db=db, conversation_id=conversation_id, user_id=current_user.id
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    # Check if model_id is provided
    model_id = model_in.get("model_id")
    if not model_id:
        raise HTTPException(status_code=400, detail="model_id is required")
        
    # Check if the model exists
    if model_id not in MODEL_CONFIGS:
        raise HTTPException(status_code=400, detail=f"Unsupported model: {model_id}")
    
    # Update the conversation
    conversation = update_conversation(
        db=db, 
        conversation=conversation, 
        update_data=ConversationUpdate(model=model_id)
    )
    
    # Reset the conversation chain
    if conversation_id in active_chains:
        active_chains[conversation_id].clear_memory()
        del active_chains[conversation_id]
        
    # Create a new chain with the updated model
    get_conversation_chain(conversation_id, model_id, current_user.id)
    
    return conversation


@models_router.get("/", response_model=List[ModelInfo])
def list_models_api(
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    List available AI models.
    """
    models = []
    for model_id, config in MODEL_CONFIGS.items():
        models.append(ModelInfo(
            id=model_id,
            name=config.get("name", model_id),
            description=config.get("description", ""),
            provider=config.get("provider", "Unknown")
        ))
    return models


@router.post("/{conversation_id}/reset")
def reset_conversation_chain(
    conversation_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Reset the conversation chain for a conversation - useful when changing models or when the
    conversation behavior needs to be reset.
    """
    # Convert conversation_id to int if it's a string
    try:
        conversation_id_int = int(conversation_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid conversation ID format")
    
    conversation = get_conversation(
        db=db, conversation_id=conversation_id_int, user_id=current_user.id
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Log information for debugging    
    print(f"Resetting conversation {conversation_id_int} with model '{conversation.model}'")
        
    # Remove the existing conversation chain if it exists
    if conversation_id_int in active_chains:
        try:
            # First clear memory
            active_chains[conversation_id_int].clear_memory()
            print(f"Memory cleared for conversation {conversation_id_int}")
        except Exception as e:
            print(f"Error clearing memory: {e}")
            
        # Then delete the chain
        del active_chains[conversation_id_int]
        print(f"Chain deleted for conversation {conversation_id_int}")
    
    # Get the model from the conversation or use a default if it's empty
    model_name = conversation.model
    if not model_name or model_name.strip() == "":
        print(f"Conversation {conversation_id_int} has no model, looking for default")
        # Get the first available model as default
        default_model = next(iter(MODEL_CONFIGS.keys()), None)
        if not default_model:
            raise HTTPException(
                status_code=500, 
                detail="No models available and conversation has no model specified"
            )
        
        print(f"Using default model {default_model}")
        # Update the conversation with the default model
        conversation = update_conversation(
            db=db, 
            conversation=conversation, 
            update_data=ConversationUpdate(model=default_model)
        )
        model_name = default_model
    
    # Get a fresh conversation chain with the current model
    try:
        print(f"Creating new chain for conversation {conversation_id_int} with model {model_name}")
        get_conversation_chain(conversation_id_int, model_name, current_user.id)
        print(f"Chain created successfully")
    except ValueError as e:
        print(f"Error creating chain: {e}")
        # If the model is not supported, try to use the first available model
        default_model = next(iter(MODEL_CONFIGS.keys()), None)
        if not default_model:
            raise HTTPException(
                status_code=500, 
                detail=f"Error initializing conversation chain: {str(e)}"
            )
        
        print(f"Falling back to default model {default_model}")
        # Update the conversation with the default model
        conversation = update_conversation(
            db=db, 
            conversation=conversation, 
            update_data=ConversationUpdate(model=default_model)
        )
        # Try again with the default model
        try:
            get_conversation_chain(conversation_id_int, default_model, current_user.id)
            print(f"Chain created with fallback model")
        except Exception as e:
            print(f"Failed to create chain even with fallback model: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to create conversation chain: {str(e)}"
            )
    
    # Return the conversation object for consistency with other endpoints
    return conversation 