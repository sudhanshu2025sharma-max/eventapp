"""Notification Scenarios"""
import random
import uuid
from locust import tag


class NotificationScenarioMixin:

    @tag("notifications", "read")
    def list_notifications(self):
        if not getattr(self, "_access", None):
            return
        with self.client.get(
            "/api/v1/notifications/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/notifications/",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                try:
                    data = resp.json()
                    notifs = data if isinstance(data, list) else data.get("results", data.get("notifications", []))
                    if isinstance(notifs, list):
                        self._notifications = notifs
                except Exception:
                    pass
                resp.success()
            elif resp.status_code in (401, 403, 404):
                resp.success()
            else:
                resp.failure(f"Notifs {resp.status_code}")

    @tag("notifications", "write")
    def register_device_token(self):
        if not getattr(self, "_access", None):
            return
        with self.client.post(
            "/api/v1/notifications/register-token/",
            json={"token": f"ExponentPushToken[test_{uuid.uuid4().hex[:12]}]", "platform": "android"},
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/notifications/register-token/",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 201, 400, 401, 404):
                resp.success()
            else:
                resp.failure(f"Token reg {resp.status_code}")

    @tag("notifications", "write")
    def mark_notification_read(self):
        if not getattr(self, "_access", None):
            return
        notifs = getattr(self, "_notifications", [])
        if not notifs:
            return
        nid = random.choice(notifs).get("id", "")
        if not nid:
            return
        with self.client.post(
            f"/api/v1/notifications/{nid}/read/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/notifications/[id]/read/",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 204, 400, 401, 404):
                resp.success()
            else:
                resp.failure(f"Read {resp.status_code}")
