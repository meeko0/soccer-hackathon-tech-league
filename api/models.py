"""Clip storage. A clip is a frame range plus annotations, never rendered video,
so it stays tiny and survives re-ingesting the match."""

import secrets
from datetime import datetime, timezone

from pydantic import model_validator
from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel

from ingest.config import FPS

MAX_CLIP_SECONDS = 10
MAX_CLIP_FRAMES = MAX_CLIP_SECONDS * FPS


def _new_id() -> str:
    return secrets.token_urlsafe(6)


class ClipBase(SQLModel):
    match_id: int = Field(index=True)
    start_frame: int = Field(ge=0)
    end_frame: int = Field(ge=0)
    title: str = Field(default="Untitled clip", max_length=120)
    notes: str = Field(default="", max_length=2000)
    tags: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    # Telestration shapes in pitch coordinates, saved with the clip.
    drawings: list[dict] = Field(default_factory=list, sa_column=Column(JSON))
    # "user" for hand-made clips, detector name for auto-generated ones.
    source: str = Field(default="user", max_length=40)


def _check_range(start: int, end: int) -> None:
    if end <= start:
        raise ValueError("end_frame must be after start_frame")
    if end - start > MAX_CLIP_FRAMES:
        raise ValueError(f"clips are limited to {MAX_CLIP_SECONDS} seconds")


class Clip(ClipBase, table=True):
    id: str = Field(default_factory=_new_id, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ClipCreate(ClipBase):
    @model_validator(mode="after")
    def _range(self):
        _check_range(self.start_frame, self.end_frame)
        return self


class ClipUpdate(SQLModel):
    start_frame: int | None = Field(default=None, ge=0)
    end_frame: int | None = Field(default=None, ge=0)
    title: str | None = Field(default=None, max_length=120)
    notes: str | None = Field(default=None, max_length=2000)
    tags: list[str] | None = None
    drawings: list[dict] | None = None
