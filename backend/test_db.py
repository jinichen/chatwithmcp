from sqlalchemy import text
from app.db.session import SessionLocal
from app.models.conversation import Conversation, Message
import sys

def test_db_connection():
    """Test database connection and table mappings"""
    try:
        # Create a session
        db = SessionLocal()
        
        # Test 1: Check if we can connect to DB
        print("Testing database connection...")
        result = db.execute(text("SELECT 1")).scalar()
        print(f"Connection test result: {result}")
        
        # Test 2: Check tables in the database
        print("\nDatabase tables:")
        tables = db.execute(text(
            "SELECT tablename FROM pg_catalog.pg_tables "
            "WHERE schemaname = 'public'"
        )).fetchall()
        for table in tables:
            print(f"- {table[0]}")
        
        # Test 3: Try to query Conversation model
        print("\nTesting Conversation model query...")
        query = db.query(Conversation)
        print(f"SQL Query: {query.statement}")
        
        # Execute the query
        try:
            conversations = query.limit(1).all()
            print(f"Query successful, returned {len(conversations)} conversations")
            if conversations:
                print(f"First conversation ID: {conversations[0].id}")
        except Exception as e:
            print(f"Query failed: {e}")
        
        db.close()
        print("\nTests completed")
        
    except Exception as e:
        print(f"Error: {e}")
        return False
    
    return True

if __name__ == "__main__":
    print("Starting database tests...")
    success = test_db_connection()
    sys.exit(0 if success else 1) 