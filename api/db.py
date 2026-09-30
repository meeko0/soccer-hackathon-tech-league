"""SQLite for zero-setup persistence; swap DATABASE_URL for Postgres in production."""

import os

from sqlmodel import Session, SQLModel, create_engine

from ingest.config import CACHE_DIR

CACHE_DIR.mkdir(parents=True, exist_ok=True)
DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{(CACHE_DIR / 'clipper.db').as_posix()}")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)


def init_db() -> None:
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
