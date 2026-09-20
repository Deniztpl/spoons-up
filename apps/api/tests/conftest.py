import os
from collections.abc import Generator
from pathlib import Path

import pytest
from alembic.config import Config
from fastapi.testclient import TestClient
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session

from alembic import command

API_ROOT = Path(__file__).resolve().parents[1]


class _TestDatabaseSettings(BaseSettings):
    test_database_url: str = "postgresql+psycopg://spoons:spoons@localhost:5433/spoons_test"

    model_config = SettingsConfigDict(env_file=API_ROOT / ".env", extra="ignore")


TEST_DATABASE_URL = _TestDatabaseSettings().test_database_url
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ.setdefault("JWT_SECRET", "test-only-secret-that-is-at-least-32-characters")


@pytest.fixture(scope="session", autouse=True)
def migrated_database() -> Generator[Engine, None, None]:
    alembic_config = Config(str(API_ROOT / "alembic.ini"))
    command.upgrade(alembic_config, "head")
    engine = create_engine(TEST_DATABASE_URL, pool_pre_ping=True)

    try:
        yield engine
    finally:
        engine.dispose()
        command.downgrade(alembic_config, "base")


@pytest.fixture
def db_session(migrated_database: Engine) -> Generator[Session, None, None]:
    connection = migrated_database.connect()
    transaction = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint")

    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    from app.core.database import get_db
    from app.main import app

    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
