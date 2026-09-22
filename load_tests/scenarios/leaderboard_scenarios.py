"""Leaderboard Scenarios"""
from locust import tag


class LeaderboardScenarioMixin:

    @tag("leaderboard", "read")
    def view_leaderboard(self):
        if not getattr(self, "_access", None):
            return
        with self.client.get(
            "/api/v1/leaderboard/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/leaderboard/",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 401, 404):
                resp.success()
            else:
                resp.failure(f"Leaderboard {resp.status_code}")

    @tag("leaderboard", "read")
    def view_my_points(self):
        if not getattr(self, "_access", None):
            return
        with self.client.get(
            "/api/v1/leaderboard/my-points/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/leaderboard/my-points/",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 401, 404):
                resp.success()
            else:
                resp.failure(f"Points {resp.status_code}")
