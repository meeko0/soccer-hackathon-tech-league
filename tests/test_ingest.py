"""Round-trip check: packed binary files must match the raw SkillCorner JSONL.

Uses whichever ingested match is present in the cache; skips if none are.
"""

import itertools

import numpy as np
import orjson
import pytest

from ingest import config, sources
from ingest.pipeline import match_dir

MATCHES = sorted(p.name for p in (config.CACHE_DIR / "matches").glob("*") if (p / "meta.json").exists()) \
    if (config.CACHE_DIR / "matches").exists() else []


def _load(match_id: str):
    d = match_dir(int(match_id))
    meta = orjson.loads((d / "meta.json").read_bytes())
    arr = {}
    for name, spec in meta["files"].items():
        arr[name] = np.frombuffer((d / name).read_bytes(), dtype="<" + np.dtype(spec["dtype"]).str[1:]) \
            .reshape(spec["shape"])
    return meta, arr


@pytest.mark.skipif(not MATCHES, reason="no ingested match in cache")
@pytest.mark.parametrize("match_id", MATCHES)
def test_positions_round_trip(match_id):
    meta, arr = _load(match_id)
    pos, det = arr["positions.bin"], arr["detected.bin"]
    slot_of = {s["player_id"]: s["slot"] for s in meta["slots"]}
    scale, ball = meta["encoding"]["position_scale"], meta["ball_slot"]

    with open(sources.tracking(int(match_id)), "rb") as f:
        # Sample every 997th frame across the whole match.
        for line in itertools.islice(f, 0, None, 997):
            fr = orjson.loads(line)
            i = fr["frame"] - meta["frame_offset"]
            assert arr["period.bin"][i] == (fr["period"] or 0)
            present = set()
            for p in fr["player_data"]:
                s = slot_of[p["player_id"]]
                present.add(s)
                np.testing.assert_allclose(pos[i, s] / scale, (p["x"], p["y"]), atol=0.006)
                assert det[i, s] == (2 if p["is_detected"] else 1)
            absent = set(range(len(meta["slots"]))) - present
            assert all(det[i, s] == 0 for s in absent)
            b = fr["ball_data"]
            if b["x"] is not None:
                np.testing.assert_allclose(pos[i, ball] / scale, (b["x"], b["y"]), atol=0.006)


@pytest.mark.skipif(not MATCHES, reason="no ingested match in cache")
@pytest.mark.parametrize("match_id", MATCHES)
def test_meta_sane(match_id):
    meta, arr = _load(match_id)
    assert meta["n_slots"] == len(meta["slots"]) + 1
    # At most 11 players per team on the pitch in any frame.
    det = arr["detected.bin"][:, :-1] > 0
    for team in ("home", "away"):
        cols = [s["slot"] for s in meta["slots"] if s["team"] == team]
        assert det[:, cols].sum(axis=1).max() <= 11
    assert meta["home"]["color"].startswith("#")


@pytest.mark.skipif(not MATCHES, reason="no ingested match in cache")
@pytest.mark.parametrize("match_id", MATCHES)
def test_goals_match_score(match_id):
    meta, _ = _load(match_id)
    events = orjson.loads((match_dir(int(match_id)) / "events.json").read_bytes())
    goals = [e for e in events if e.get("is_goal")]
    for side in ("home", "away"):
        team_goals = sum(e["team_id"] == meta[side]["id"] for e in goals)
        assert team_goals == meta[side]["score"], side
