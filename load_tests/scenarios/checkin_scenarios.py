"""Check-In & Meal Scanning Scenarios"""
from locust import tag


class CheckinScenarioMixin:

    @tag("checkin", "read")
    def checkin_list(self):
        if not getattr(self, "_access", None):
            return
        with self.client.get(
            "/api/v1/checkins/list/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/checkins/list/",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 401, 403, 404):
                resp.success()
            else:
                resp.failure(f"Checkin {resp.status_code}")

    @tag("checkin", "read")
    def checked_in_participants(self):
        if not getattr(self, "_access", None):
            return
        with self.client.get(
            "/api/v1/checkins/checked-in/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/checkins/checked-in/",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 401, 403, 404):
                resp.success()
            else:
                resp.failure(f"Checked-in {resp.status_code}")

    @tag("checkin", "read")
    def meal_stats(self):
        if not getattr(self, "_access", None):
            return
        with self.client.get(
            "/api/v1/checkins/meal-stats/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/checkins/meal-stats/",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 401, 403, 404):
                resp.success()
            else:
                resp.failure(f"Meal {resp.status_code}")

    @tag("checkin", "read")
    def network_list(self):
        if not getattr(self, "_access", None):
            return
        with self.client.get(
            "/api/v1/checkins/network/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/checkins/network/",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                try:
                    data = resp.json()
                    users = data if isinstance(data, list) else data.get("results", data.get("users", []))
                    if isinstance(users, list):
                        self._network_users = users
                except Exception:
                    pass
                resp.success()
            elif resp.status_code in (401, 403, 404):
                resp.success()
            else:
                resp.failure(f"Network {resp.status_code}")
