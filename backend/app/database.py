import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Load environment variables from the root directory
load_dotenv(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.env")))

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://aman@localhost:5432/pumpkhata")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
