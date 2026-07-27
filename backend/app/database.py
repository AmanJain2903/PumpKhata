import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Load environment variables from the root directory
load_dotenv(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.env")))

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://aman@localhost:5432/pumpkhata")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

from sqlalchemy import event

@event.listens_for(engine, "connect")
def set_timezone(dbapi_connection, connection_record):
    if engine.dialect.name == 'postgresql':
        cursor = dbapi_connection.cursor()
        cursor.execute("SET TIME ZONE 'Asia/Kolkata';")
        cursor.close()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
