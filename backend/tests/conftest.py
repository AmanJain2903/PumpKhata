import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from datetime import datetime

# Import the FastAPI app and database dependencies
from app.main import app
from app.database import get_db
from app.models.base import Base
from app.core.security import get_current_user
from app.models.user import User, UserRole

# Use an in-memory SQLite database for testing to ensure we NEVER touch the prod DB
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

# Create an engine with StaticPool to share the same connection across threads in tests
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session")
def db_engine():
    """Create all tables in the memory database at the start of the test session."""
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def db_session(db_engine):
    """Yields a fresh database session for each test function."""
    connection = db_engine.connect()
    # Start a transaction
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    
    yield session
    
    # Rollback the transaction after the test to leave the database empty for the next test
    session.close()
    transaction.rollback()
    connection.close()

@pytest.fixture(scope="function")
def mock_user():
    """Provides a mock authenticated user for testing protected routes."""
    return User(
        id=1,
        email="testadmin@pumpkhata.com",
        first_name="Test",
        last_name="Admin",
        role=UserRole.super_admin,
        is_active=True,
        created_at=datetime.utcnow()
    )

@pytest.fixture(scope="function")
def client(db_session, mock_user):
    """Provides a FastAPI TestClient with overridden dependencies."""
    
    # Override get_db to return our isolated test session
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    # Override get_current_user to return our mock user
    def override_get_current_user():
        return mock_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    
    with TestClient(app) as test_client:
        yield test_client
        
    # Clear overrides after the test
    app.dependency_overrides.clear()
