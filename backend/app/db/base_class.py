from typing import Any
from sqlalchemy.ext.declarative import as_declarative, declared_attr


@as_declarative()
class Base:
    id: Any
    __name__: str

    # Generate __tablename__ automatically only if not explicitly set in model class
    @declared_attr
    def __tablename__(cls) -> str:
        # Allow models to override this by defining their own __tablename__
        if hasattr(cls, '_explicit_tablename'):
            return cls._explicit_tablename
        return cls.__name__.lower() 