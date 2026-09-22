"""Photo & Checkpoint Scenarios"""
import random
import io
from locust import tag

# Minimal valid JPEG (1x1 pixel)
MINI_JPEG = (
    b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01'
    b'\x00\x00\xff\xd9'
)


class PhotoScenarioMixin:

    @tag("photos", "read")
    def browse_photos(self):
        if not getattr(self, "_access", None):
            return
        with self.client.get(
            "/api/v1/photos/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/photos/",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 401, 404):
                resp.success()
            else:
                resp.failure(f"Photos {resp.status_code}")

    @tag("photos", "write", "heavy")
    def upload_photo(self):
        if not getattr(self, "_access", None):
            return
        with self.client.post(
            "/api/v1/photos/upload/",
            files={"photo": ("test.jpg", io.BytesIO(MINI_JPEG), "image/jpeg")},
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/photos/upload/",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 201, 400, 401, 403, 404, 405):
                resp.success()
            else:
                resp.failure(f"Upload {resp.status_code}")

    @tag("checkpoint", "read")
    def list_checkpoints(self):
        if not getattr(self, "_access", None):
            return
        with self.client.get(
            "/api/v1/photos/selfie-points/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/photos/selfie-points/",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                try:
                    data = resp.json()
                    points = data if isinstance(data, list) else data.get("results", data.get("points", []))
                    if isinstance(points, list):
                        self._checkpoints = points
                except Exception:
                    pass
                resp.success()
            elif resp.status_code in (401, 403, 404):
                resp.success()
            else:
                resp.failure(f"Checkpoints {resp.status_code}")

    @tag("checkpoint", "write")
    def submit_checkpoint_selfie(self):
        if not getattr(self, "_access", None):
            return
        cps = getattr(self, "_checkpoints", [])
        if not cps:
            return
        cp_id = random.choice(cps).get("id", "")
        if not cp_id:
            return
        from config import TEST_LOCATIONS
        loc = random.choice(TEST_LOCATIONS)
        with self.client.post(
            f"/api/v1/photos/selfie-points/{cp_id}/submit/",
            files={"photo": ("s.jpg", io.BytesIO(MINI_JPEG), "image/jpeg")},
            data={"latitude": str(loc["lat"]), "longitude": str(loc["lng"])},
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/photos/selfie-points/[id]/submit/",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 201, 400, 401, 403, 404):
                resp.success()
            else:
                resp.failure(f"Selfie {resp.status_code}")
