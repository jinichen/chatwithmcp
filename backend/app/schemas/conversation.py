from typing import List, Optional, Dict, Any, Union
from datetime import datetime
from pydantic import BaseModel, Field


class MessageBase(BaseModel):
    content: str
    role: str = "user"
    meta_data: Optional[Dict] = None


class MessageCreate(MessageBase):
    pass


class MessageUpdate(MessageBase):
    pass


class Message(MessageBase):
    id: int
    conversation_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class MessageInDB(Message):
    pass


class ConversationBase(BaseModel):
    title: Optional[str] = None
    model: Optional[str] = None
    meta_data: Optional[Dict] = None


class ConversationCreate(ConversationBase):
    pass


class ConversationUpdate(ConversationBase):
    pass


class Conversation(ConversationBase):
    id: Union[int, str] 
    created_at: datetime
    updated_at: Optional[datetime] = None
    messages: List[Message] = []

    class Config:
        from_attributes = True


class ConversationInDB(Conversation):
    pass


class ConversationPagination(BaseModel):
    total: int
    items: List[Conversation]
    page: int
    size: int


class MessagePagination(BaseModel):
    total: int
    items: List[Message]
    page: int
    size: int


class StreamResponse(BaseModel):
    content: str
    done: bool = False


class ModelInfo(BaseModel):
    id: str
    name: str
    provider: str
    description: Optional[str] = None
    capabilities: List[str] = []
    parameters: Dict[str, Any] = Field(default_factory=dict) 