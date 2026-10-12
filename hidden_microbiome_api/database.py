from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# FIX: URL-encoded the '@' in the password to '%40' to prevent connection strings from breaking
SQLALCHEMY_DATABASE_URL = "postgresql://postgres:MSC25%40@localhost:5432/HiddenMicrobiome"

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()