"""Four API checks for passenger ride requests in UP Drive V2."""

import json
import os
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import APIRequestContext, Playwright, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
RESULT_DIR = ROOT / "test-results"
BASE_URL = os.getenv("BASE_URL", "http://127.0.0.1:3000")


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_dotenv(ROOT / ".env")


class RideRequestE2E(unittest.TestCase):
    playwright: Playwright
    api: APIRequestContext
    token: str
    passenger_id: str
    created_ride_id: str | None = None
    created_group_id: str | None = None
    cancelled = False
    results: list[dict] = []

    @classmethod
    def setUpClass(cls) -> None:
        email = os.getenv("E2E_PASSENGER_EMAIL")
        password = os.getenv("E2E_PASSENGER_PASSWORD")
        if not email or not password:
            raise unittest.SkipTest(
                "Set E2E_PASSENGER_EMAIL and E2E_PASSENGER_PASSWORD in .env"
            )
        RESULT_DIR.mkdir(exist_ok=True)
        cls.playwright = sync_playwright().start()
        cls.api = cls.playwright.request.new_context(base_url=BASE_URL)
        login = cls.api.post(
            "/api/auth/login", data={"email": email, "password": password}
        )
        if login.status != 200:
            raise RuntimeError(f"Test account login failed with HTTP {login.status}")
        payload = login.json()
        profile = payload.get("profile") or {}
        if profile.get("role") != "passenger":
            raise RuntimeError("The test account must have the passenger role")
        cls.passenger_id = profile["id"]
        cls.token = payload["session"]["access_token"]

    @classmethod
    def tearDownClass(cls) -> None:
        if (
            hasattr(cls, "api")
            and hasattr(cls, "token")
            and cls.created_ride_id
            and not cls.cancelled
        ):
            try:
                cls.api.post(
                    f"/api/rides/{cls.created_ride_id}/cancel",
                    headers=cls.auth_headers(),
                )
            except Exception:
                pass
        if hasattr(cls, "api"):
            cls.api.dispose()
        if hasattr(cls, "playwright"):
            cls.playwright.stop()
        RESULT_DIR.mkdir(exist_ok=True)
        (RESULT_DIR / "ride-request-results.json").write_text(
            json.dumps(
                {
                    "generated_at": datetime.now(timezone.utc).isoformat(),
                    "base_url": BASE_URL,
                    "passenger_id": getattr(cls, "passenger_id", None),
                    "created_ride_id": cls.created_ride_id,
                    "created_group_id": cls.created_group_id,
                    "cancelled": cls.cancelled,
                    "results": cls.results,
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )

    @classmethod
    def auth_headers(cls) -> dict[str, str]:
        return {"Authorization": f"Bearer {cls.token}"}

    def record(self, case_id: str, evidence: str) -> None:
        self.__class__.results.append(
            {"case_id": case_id, "status": "passed", "evidence": evidence}
        )

    def test_01_create_ride(self) -> None:
        response = self.api.post(
            "/api/rides",
            headers=self.auth_headers(),
            data={
                "origin_text": "กว๊านพะเยา",
                "destination_text": "สถานีขนส่งพะเยา",
                "origin_detail": "จุดนัดพบหน้าทางเข้า",
                "destination_detail": "ประตูหลัก",
                "origin_lat": 19.1700,
                "origin_lng": 99.9000,
                "destination_lat": 19.1500,
                "destination_lng": 99.9100,
                "target_passengers": 2,
            },
        )
        self.assertEqual(response.status, 201, response.text())
        ride = response.json()["ride"]
        self.__class__.created_ride_id = ride["id"]
        self.__class__.created_group_id = ride["group_id"]
        self.assertEqual(ride["passenger_id"], self.passenger_id)
        self.assertEqual(ride["origin_text"], "กว๊านพะเยา")
        self.assertEqual(ride["destination_text"], "สถานีขนส่งพะเยา")
        self.record("TC-01", f"HTTP 201; ride_id={ride['id']}")

    def test_02_read_created_ride(self) -> None:
        self.assertIsNotNone(self.created_ride_id, "TC-01 must create a ride first")
        response = self.api.get(
            f"/api/rides/{self.created_ride_id}", headers=self.auth_headers()
        )
        self.assertEqual(response.status, 200, response.text())
        ride = response.json()["ride"]
        self.assertEqual(ride["id"], self.created_ride_id)
        self.assertEqual(ride["passenger_id"], self.passenger_id)
        self.assertEqual(ride["origin_text"], "กว๊านพะเยา")
        self.assertEqual(ride["group_id"], self.created_group_id)
        self.record("TC-02", "HTTP 200; saved ride matches the created ride")

    def test_03_cancel_created_ride(self) -> None:
        self.assertIsNotNone(self.created_ride_id, "TC-01 must create a ride first")
        response = self.api.post(
            f"/api/rides/{self.created_ride_id}/cancel",
            headers=self.auth_headers(),
        )
        self.assertEqual(response.status, 200, response.text())
        stored = self.api.get(
            f"/api/rides/{self.created_ride_id}", headers=self.auth_headers()
        )
        self.assertEqual(stored.status, 200, stored.text())
        self.assertEqual(stored.json()["ride"]["status"], "cancelled")
        self.__class__.cancelled = True
        self.record("TC-03", "HTTP 200; saved ride status changed to cancelled")

    def test_04_reject_missing_origin(self) -> None:
        response = self.api.post(
            "/api/rides",
            headers=self.auth_headers(),
            data={
                "origin_text": "",
                "destination_text": "สถานีขนส่งพะเยา",
                "origin_lat": 19.1700,
                "origin_lng": 99.9000,
                "destination_lat": 19.1500,
                "destination_lng": 99.9100,
                "target_passengers": 2,
            },
        )
        self.assertEqual(response.status, 400, response.text())
        self.assertIn("กรุณาระบุจุดรับ", response.json()["error"])
        self.record("TC-04", "HTTP 400; empty origin was rejected")


if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(RideRequestE2E)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)
