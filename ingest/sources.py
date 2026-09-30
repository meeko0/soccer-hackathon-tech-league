"""Locate SkillCorner open-data files: local clone first, GitHub second."""

from pathlib import Path

import httpx

from . import config


class SourceError(RuntimeError):
    pass


def _match_file(match_id: int, suffix: str) -> str:
    return f"data/matches/{match_id}/{match_id}_{suffix}"


def _local(rel: str) -> Path | None:
    if config.OPENDATA_DIR is None:
        return None
    path = config.OPENDATA_DIR / rel
    # A Git LFS pointer file (not pulled) is ~130 bytes of text; treat it as missing.
    if path.is_file() and path.stat().st_size > 1024:
        return path
    return None


def _download(url: str, dest: Path) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    try:
        with httpx.stream("GET", url, follow_redirects=True, timeout=120) as r:
            if r.status_code == 404:
                raise SourceError(f"Not found in SkillCorner open data: {url}")
            r.raise_for_status()
            with open(tmp, "wb") as f:
                for chunk in r.iter_bytes(1 << 20):
                    f.write(chunk)
    except httpx.HTTPError as e:
        tmp.unlink(missing_ok=True)
        raise SourceError(f"Download failed for {url}: {e}") from e
    tmp.replace(dest)
    return dest


def fetch(rel: str, lfs: bool = False) -> Path:
    """Return a local path for an open-data file, downloading it if needed."""
    local = _local(rel)
    if local:
        return local
    cached = config.CACHE_DIR / "raw" / rel
    if cached.is_file():
        return cached
    base = config.LFS_BASE if lfs else config.RAW_BASE
    return _download(f"{base}/{rel}", cached)


def match_json(match_id: int) -> Path:
    return fetch(_match_file(match_id, "match.json"))


def tracking(match_id: int) -> Path:
    return fetch(_match_file(match_id, "tracking_extrapolated.jsonl"), lfs=True)


def dynamic_events(match_id: int) -> Path:
    return fetch(_match_file(match_id, "dynamic_events.csv"))


def phases_of_play(match_id: int) -> Path:
    return fetch(_match_file(match_id, "phases_of_play.csv"))


def matches_index() -> Path:
    return fetch("data/matches.json")
