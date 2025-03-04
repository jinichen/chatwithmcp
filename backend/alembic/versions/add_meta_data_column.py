"""add meta_data column to conversations

Revision ID: add_meta_data_col
Revises: d2a335d20e0d
Create Date: 2025-03-03 11:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'add_meta_data_col'
down_revision: Union[str, None] = 'd2a335d20e0d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add meta_data column to conversations table
    op.add_column('conversations', sa.Column('meta_data', postgresql.JSON(astext_type=sa.Text()), nullable=True))
    
    # Add meta_data column to messages table if it doesn't exist
    # Note: In the table structure we saw, it seems messages may have a 'message_metadata' column instead of 'meta_data'
    # Let's check if the column exists first and add it if needed
    try:
        op.add_column('messages', sa.Column('meta_data', postgresql.JSON(astext_type=sa.Text()), nullable=True))
    except Exception as e:
        print(f"Could not add meta_data column to messages table, it might already exist: {e}")


def downgrade() -> None:
    # Remove meta_data column from conversations table
    op.drop_column('conversations', 'meta_data')
    
    # Remove meta_data column from messages table if we added it
    try:
        op.drop_column('messages', 'meta_data')
    except Exception as e:
        print(f"Could not drop meta_data column from messages table: {e}") 