"""Paths and data-source settings, all overridable by environment variables."""

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Where processed match files and the SQLite DB are written.
CACHE_DIR = Path(os.environ.get("CLIPPER_CACHE_DIR", ROOT / "data"))

# Optional local clone of github.com/SkillCorner/opendata. When a file exists
# there it is read directly; otherwise it is downloaded from GitHub.
_opendata = os.environ.get("OPENDATA_DIR", str(ROOT.parent / "opendata"))
OPENDATA_DIR = Path(_opendata) if _opendata else None

GITHUB_REPO = os.environ.get("OPENDATA_REPO", "SkillCorner/opendata")
GITHUB_REF = os.environ.get("OPENDATA_REF", "master")
RAW_BASE = f"https://raw.githubusercontent.com/{GITHUB_REPO}/{GITHUB_REF}"
# Tracking files are stored in Git LFS, which raw.githubusercontent does not resolve.
LFS_BASE = f"https://media.githubusercontent.com/media/{GITHUB_REPO}/{GITHUB_REF}"

FPS = 10
