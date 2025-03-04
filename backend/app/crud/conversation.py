from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc
from fastapi.encoders import jsonable_encoder

from app.models.conversation import Conversation, Message
from app.schemas.conversation import ConversationCreate, ConversationUpdate, MessageCreate


def get_conversation(db: Session, conversation_id: int, user_id: int) -> Optional[Conversation]:
    return db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == user_id
    ).first()


def get_conversations(
    db: Session, user_id: int, skip: int = 0, limit: int = 10
) -> tuple[List[Conversation], int]:
    query = db.query(Conversation).filter(Conversation.user_id == user_id)
    total = query.count()
    items = query.order_by(desc(Conversation.updated_at)).offset(skip).limit(limit).all()
    return items, total


def create_conversation(
    db: Session, conversation: ConversationCreate, user_id: int
) -> Conversation:
    db_conversation = Conversation(
        **conversation.model_dump(),
        user_id=user_id
    )
    db.add(db_conversation)
    db.commit()
    db.refresh(db_conversation)
    return db_conversation


def update_conversation(
    db: Session, conversation: Conversation, update_data: ConversationUpdate
) -> Conversation:
    update_dict = update_data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(conversation, field, value)
    db.commit()
    db.refresh(conversation)
    return conversation


def delete_conversation(db: Session, conversation: Conversation) -> None:
    db.delete(conversation)
    db.commit()


def get_messages(
    db: Session, conversation_id: int, skip: int = 0, limit: int = 50
) -> tuple[List[Message], int]:
    query = db.query(Message).filter(Message.conversation_id == conversation_id)
    total = query.count()
    items = query.order_by(Message.created_at).offset(skip).limit(limit).all()
    return items, total


def create_message(
    db: Session, message: MessageCreate, conversation_id: int
) -> Message:
    db_message = Message(
        **message.model_dump(),
        conversation_id=conversation_id
    )
    db.add(db_message)
    
    # Update conversation's updated_at timestamp
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if conversation:
        conversation.updated_at = db_message.created_at
    
    db.commit()
    db.refresh(db_message)
    return db_message


def delete_message(db: Session, message: Message) -> None:
    db.delete(message)
    db.commit() 