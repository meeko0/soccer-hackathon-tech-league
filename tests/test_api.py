import os
import tempfile

import pytest

# Isolated DB per test run; must be set before the app is imported.
os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp()}/test.db"

from fastapi.testclient import TestClient  # noqa: E402

from api.main import app  # noqa: E402
from tests.test_ingest import MATCHES  # noqa: E402

pytestmark = pytest.mark.skipif(not MATCHES, reason="no ingested match in cache")


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_files_served(client):
    mid = MATCHES[0]
    meta = client.get(f"/api/matches/{mid}/files/meta.json").json()
    assert meta["match_id"] == int(mid)
    assert client.get(f"/api/matches/{mid}/files/../../clipper.db").status_code == 404
    assert client.get(f"/api/matches/{mid}/files/secret.bin").status_code == 404


def test_clip_lifecycle(client):
    mid = int(MATCHES[0])
    r = client.post("/api/clips", json={"match_id": mid, "start_frame": 100, "end_frame": 180,
                                        "title": "Run in behind", "tags": ["run"]})
    assert r.status_code == 201, r.text
    clip = r.json()
    assert client.get(f"/api/clips/{clip['id']}").json()["title"] == "Run in behind"
    assert any(c["id"] == clip["id"] for c in client.get("/api/clips", params={"tag": "run"}).json())

    # Stretching past 10 s is rejected on update too.
    assert client.patch(f"/api/clips/{clip['id']}", json={"end_frame": 300}).status_code == 422
    assert client.patch(f"/api/clips/{clip['id']}", json={"notes": "decoy"}).json()["notes"] == "decoy"
    assert client.delete(f"/api/clips/{clip['id']}").status_code == 204
    assert client.get(f"/api/clips/{clip['id']}").status_code == 404


@pytest.mark.parametrize("start,end", [(100, 201), (100, 100), (200, 100)])
def test_clip_length_enforced(client, start, end):
    r = client.post("/api/clips", json={"match_id": int(MATCHES[0]), "start_frame": start, "end_frame": end})
    assert r.status_code == 422
