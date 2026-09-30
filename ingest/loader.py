"""Parse SkillCorner match metadata and tracking JSONL into NumPy arrays.

SkillCorner coordinates are already in metres with the origin at the centre
spot, so no rescaling is needed; pitch size comes from the match file.
"""

from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import orjson

MISSING = np.int16(-32768)  # sentinel for "not on the pitch this frame"
SCALE = 100  # positions stored as int16 centimetres

# detected.bin values
NOT_PRESENT, EXTRAPOLATED, DETECTED = 0, 1, 2
# possession.bin values
NO_POSSESSION, HOME, AWAY = 0, 1, 2


@dataclass
class Tracking:
    frame_offset: int
    positions: np.ndarray  # int16 [frames, slots, 2]; last slot is the ball
    detected: np.ndarray  # uint8 [frames, slots]
    ball_z: np.ndarray  # int16 [frames] centimetres
    clock: np.ndarray  # float32 [frames] match-clock seconds (NaN outside play)
    period: np.ndarray  # int8 [frames], 0 = no period
    possession: np.ndarray  # int8 [frames] team in possession
    possession_slot: np.ndarray  # int16 [frames] slot of player in possession, -1 = none
    slot_player_ids: list[int] = field(default_factory=list)
    unknown_player_ids: set[int] = field(default_factory=set)

    @property
    def n_frames(self) -> int:
        return self.positions.shape[0]


def load_match_json(path: Path) -> dict:
    return orjson.loads(path.read_bytes())


def _clock_seconds(ts: str | None) -> float:
    if not ts:
        return np.nan
    h, m, s = ts.split(":")
    return int(h) * 3600 + int(m) * 60 + float(s)


def _to_cm(v) -> np.int16:
    return MISSING if v is None else np.int16(round(v * SCALE))


def roster_order(match: dict) -> list[dict]:
    """Home players then away, starters first, then by shirt number."""
    home_id = match["home_team"]["id"]

    def key(p):
        pt = (p.get("playing_time") or {}).get("total") or {}
        start = pt.get("start_frame")
        return (p["team_id"] != home_id, start is None, start or 0, p.get("number") or 0)

    return sorted(match["players"], key=key)


def load_tracking(path: Path, match: dict) -> Tracking:
    players = roster_order(match)
    home_id = match["home_team"]["id"]
    slot_of = {p["id"]: i for i, p in enumerate(players)}
    n_players = len(players)
    ball = n_players
    n_slots = n_players + 1

    with open(path, "rb") as f:
        lines = [ln for ln in f if ln.strip()]
    first = orjson.loads(lines[0])["frame"]
    n_frames = orjson.loads(lines[-1])["frame"] - first + 1

    positions = np.full((n_frames, n_slots, 2), MISSING, dtype=np.int16)
    detected = np.zeros((n_frames, n_slots), dtype=np.uint8)
    ball_z = np.full(n_frames, MISSING, dtype=np.int16)
    clock = np.full(n_frames, np.nan, dtype=np.float32)
    period = np.zeros(n_frames, dtype=np.int8)
    possession = np.zeros(n_frames, dtype=np.int8)
    possession_slot = np.full(n_frames, -1, dtype=np.int16)
    unknown: set[int] = set()

    for line in lines:
        fr = orjson.loads(line)
        i = fr["frame"] - first
        if not 0 <= i < n_frames:
            continue
        period[i] = fr.get("period") or 0
        clock[i] = _clock_seconds(fr.get("timestamp"))

        b = fr.get("ball_data") or {}
        if b.get("x") is not None:
            positions[i, ball] = (_to_cm(b["x"]), _to_cm(b["y"]))
            ball_z[i] = _to_cm(b.get("z"))
            detected[i, ball] = DETECTED if b.get("is_detected") else EXTRAPOLATED

        poss = fr.get("possession") or {}
        possession[i] = {"home team": HOME, "away team": AWAY}.get(poss.get("group"), NO_POSSESSION)
        if poss.get("player_id") in slot_of:
            possession_slot[i] = slot_of[poss["player_id"]]

        for p in fr.get("player_data") or ():
            s = slot_of.get(p["player_id"])
            if s is None:
                unknown.add(p["player_id"])
                continue
            if p.get("x") is None:
                continue
            positions[i, s] = (_to_cm(p["x"]), _to_cm(p["y"]))
            detected[i, s] = DETECTED if p.get("is_detected") else EXTRAPOLATED

    # Drop roster players who never appear (unused substitutes); keep the ball.
    used = detected[:, :n_players].any(axis=0)
    keep = np.append(np.flatnonzero(used), ball)
    remap = {int(old): new for new, old in enumerate(keep)}
    possession_slot = np.where(
        possession_slot >= 0,
        np.vectorize(lambda s: remap.get(int(s), -1), otypes=[np.int16])(possession_slot),
        -1,
    ).astype(np.int16)

    return Tracking(
        frame_offset=first,
        positions=np.ascontiguousarray(positions[:, keep]),
        detected=np.ascontiguousarray(detected[:, keep]),
        ball_z=ball_z,
        clock=clock,
        period=period,
        possession=possession,
        possession_slot=possession_slot,
        slot_player_ids=[players[k]["id"] for k in keep[:-1]],
        unknown_player_ids=unknown,
    )


def build_meta(match: dict, trk: Tracking, fps: int) -> dict:
    """Everything the frontend needs to interpret the binary files."""
    home_id = match["home_team"]["id"]
    by_id = {p["id"]: p for p in match["players"]}

    def team(side: str) -> dict:
        t, kit = match[f"{side}_team"], match.get(f"{side}_team_kit") or {}
        return {
            "id": t["id"],
            "name": t["name"],
            "short_name": t["short_name"],
            "acronym": t.get("acronym"),
            "score": match.get(f"{side}_team_score"),
            "color": kit.get("jersey_color") or ("#1f6feb" if side == "home" else "#d73a49"),
            "number_color": kit.get("number_color") or "#ffffff",
        }

    slots = []
    for s, pid in enumerate(trk.slot_player_ids):
        p = by_id[pid]
        role = p.get("player_role") or {}
        pt = (p.get("playing_time") or {}).get("total") or {}
        slots.append(
            {
                "slot": s,
                "player_id": pid,
                "team": "home" if p["team_id"] == home_id else "away",
                "number": p.get("number"),
                "name": f"{p.get('first_name', '')} {p.get('last_name', '')}".strip(),
                "short_name": p.get("short_name"),
                "position": role.get("acronym"),
                "position_group": role.get("position_group"),
                "is_goalkeeper": role.get("acronym") == "GK",
                "start_frame": pt.get("start_frame"),
                "end_frame": pt.get("end_frame"),
            }
        )

    sides = match.get("home_team_side") or []
    periods = [
        {
            "period": mp["period"],
            "start_frame": mp["start_frame"],
            "end_frame": mp["end_frame"],
            # Direction the home team attacks in this period.
            "home_attacks": sides[k] if k < len(sides) else None,
        }
        for k, mp in enumerate(match.get("match_periods") or [])
    ]

    return {
        "match_id": match["id"],
        "date_time": match.get("date_time"),
        "competition": ((match.get("competition_edition") or {}).get("name")),
        "stadium": (match.get("stadium") or {}).get("name"),
        "fps": fps,
        "n_frames": trk.n_frames,
        "frame_offset": trk.frame_offset,
        "pitch": {"length": match.get("pitch_length", 105), "width": match.get("pitch_width", 68)},
        "home": team("home"),
        "away": team("away"),
        "periods": periods,
        "slots": slots,
        "ball_slot": len(slots),
        "n_slots": len(slots) + 1,
    }
