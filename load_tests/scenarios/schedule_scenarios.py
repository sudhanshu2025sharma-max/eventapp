"""Schedule Browsing Scenarios"""
import random
from locust import tag


class ScheduleScenarioMixin:

    @tag("schedule", "critical", "read")
    def browse_schedule(self):
        if not getattr(self, "_access", None):
            return
        with self.client.get(
            "/api/v1/schedule/sessions/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/schedule/sessions/",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                try:
                    data = resp.json()
                    sessions = data if isinstance(data, list) else data.get("results", data.get("sessions", []))
                    if isinstance(sessions, list):
                        self._schedule_sessions = sessions
                except Exception:
                    pass
                resp.success()
            elif resp.status_code in (401, 404):
                resp.success()
            else:
                resp.failure(f"Schedule {resp.status_code}")

    @tag("schedule", "read")
    def view_session_detail(self):
        if not getattr(self, "_access", None):
            return
        sessions = getattr(self, "_schedule_sessions", [])
        if not sessions:
            return
        session = random.choice(sessions)
        sid = session.get("id", "")
        if not sid:
            return
        with self.client.get(
            f"/api/v1/schedule/sessions/{sid}/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/schedule/sessions/[id]/",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 401, 404):
                resp.success()
            else:
                resp.failure(f"Session detail {resp.status_code}")

    @tag("schedule", "write")
    def toggle_bookmark(self):
        if not getattr(self, "_access", None):
            return
        sessions = getattr(self, "_schedule_sessions", [])
        if not sessions:
            return
        sid = random.choice(sessions).get("id", "")
        if not sid:
            return
        with self.client.post(
            f"/api/v1/schedule/sessions/{sid}/bookmark/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/schedule/sessions/[id]/bookmark/",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 201, 204, 400, 401, 404, 405):
                resp.success()
            else:
                resp.failure(f"Bookmark {resp.status_code}")
