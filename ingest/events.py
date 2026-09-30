"""Slim the dynamic-events and phases-of-play CSVs down to what the app uses.

Columns are whitelisted but optional: if SkillCorner renames or drops one, the
field is simply omitted instead of breaking ingest for that match.

Event x/y are normalised so the acting team always attacks towards +x; tracking
is absolute. Flip both signs when attacking_side == "right_to_left" to overlay.
"""

from pathlib import Path

import numpy as np
import pandas as pd

EVENT_COLUMNS = [
    "event_id", "event_type", "event_subtype", "frame_start", "frame_end", "period",
    "time_start", "time_end", "duration", "attacking_side",
    "player_id", "player_name", "player_position", "team_id", "team_shortname",
    "player_in_possession_id", "player_in_possession_name",
    "x_start", "y_start", "x_end", "y_end", "third_start", "third_end",
    "end_type", "pass_outcome", "lead_to_shot", "lead_to_goal",
    "targeted", "received", "received_in_space", "dangerous", "xthreat",
    "distance_covered", "speed_avg",
    "associated_player_possession_event_id", "associated_off_ball_run_event_id",
    "pressing_chain_end_type", "game_state", "team_in_possession_phase_type",
    "start_type", "phase_index",
]

PHASE_COLUMNS = [
    "index", "frame_start", "frame_end", "period", "attacking_side",
    "team_in_possession_id", "team_in_possession_shortname",
    "team_in_possession_phase_type", "team_out_of_possession_phase_type",
    "team_possession_lead_to_shot", "team_possession_lead_to_goal",
    "team_possession_loss_in_phase",
]

INT_COLUMNS = {"frame_start", "frame_end", "period", "player_id", "team_id",
               "player_in_possession_id", "team_in_possession_id", "phase_index", "index"}


def _records(path: Path, columns: list[str]) -> list[dict]:
    df = pd.read_csv(path, low_memory=False)
    df = df[[c for c in columns if c in df.columns]]
    df = df.dropna(subset=[c for c in ("frame_start", "frame_end") if c in df.columns])
    for c in INT_COLUMNS & set(df.columns):
        df[c] = df[c].astype("Int64")
    df = df.astype(object).where(pd.notna(df), None)
    out = []
    for row in df.to_dict(orient="records"):
        rec = {}
        for k, v in row.items():
            if v is None or v == "":
                continue
            if isinstance(v, np.generic):
                v = v.item()
            rec[k] = v
        out.append(rec)
    return out


def _mark_goals(events: list[dict]) -> None:
    """lead_to_goal flags every shot in the scoring move (e.g. a saved shot and
    its rebound), so only the last flagged shot per phase is the goal."""
    last_by_phase: dict = {}
    for e in events:
        if e.get("end_type") == "shot" and e.get("lead_to_goal"):
            key = e.get("phase_index", e["frame_start"])
            prev = last_by_phase.get(key)
            if prev is None or e["frame_end"] > prev["frame_end"]:
                last_by_phase[key] = e
    for e in last_by_phase.values():
        e["is_goal"] = True


def load_events(path: Path) -> list[dict]:
    events = sorted(_records(path, EVENT_COLUMNS), key=lambda e: e["frame_start"])
    _mark_goals(events)
    return events


def load_phases(path: Path) -> list[dict]:
    return sorted(_records(path, PHASE_COLUMNS), key=lambda p: p["frame_start"])
