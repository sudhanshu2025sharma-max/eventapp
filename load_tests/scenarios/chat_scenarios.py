"""Chat & Connection Scenarios"""
import random
import uuid
from locust import tag


class ChatScenarioMixin:

    @tag("chat", "read")
    def list_conversations(self):
        if not getattr(self, "_access", None):
            return
        with self.client.get(
            "/api/v1/chat/conversations/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/chat/conversations/",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                try:
                    data = resp.json()
                    convs = data if isinstance(data, list) else data.get("results", data.get("conversations", []))
                    if isinstance(convs, list):
                        self._conversations = convs
                except Exception:
                    pass
                resp.success()
            elif resp.status_code in (401, 403, 404):
                resp.success()
            else:
                resp.failure(f"Conversations {resp.status_code}")

    @tag("chat", "read")
    def list_connection_requests(self):
        if not getattr(self, "_access", None):
            return
        with self.client.get(
            "/api/v1/chat/requests/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/chat/requests/",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 401, 403, 404):
                resp.success()
            else:
                resp.failure(f"Requests {resp.status_code}")

    @tag("chat", "write")
    def send_message_to_conversation(self):
        if not getattr(self, "_access", None):
            return
        convs = getattr(self, "_conversations", [])
        if not convs:
            return
        conv_id = random.choice(convs).get("id", "")
        if not conv_id:
            return
        with self.client.post(
            f"/api/v1/chat/conversations/{conv_id}/messages/",
            json={"content": f"Load test {uuid.uuid4().hex[:6]}"},
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/chat/conversations/[id]/messages/",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 201, 400, 401, 403, 404):
                resp.success()
            else:
                resp.failure(f"Send msg {resp.status_code}")

    @tag("chat", "staff")
    def staff_group_chat_read(self):
        if not getattr(self, "_access", None):
            return
        with self.client.get(
            "/api/v1/chat/staff-group/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/chat/staff-group/ [GET]",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 401, 403):
                resp.success()
            else:
                resp.failure(f"Staff chat read {resp.status_code}")

    @tag("chat", "staff")
    def staff_group_chat_send(self):
        if not getattr(self, "_access", None):
            return
        with self.client.post(
            "/api/v1/chat/staff-group/",
            json={"content": f"[LOAD] {random.randint(1,999)}"},
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/chat/staff-group/ [POST]",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 201, 401, 403):
                resp.success()
            else:
                resp.failure(f"Staff chat send {resp.status_code}")

    @tag("chat", "write")
    def send_connection_request(self):
        if not getattr(self, "_access", None):
            return
        users = getattr(self, "_network_users", [])
        if not users:
            return
        target_id = random.choice(users).get("id", "")
        if not target_id:
            return
        with self.client.post(
            "/api/v1/chat/send-request/",
            json={"receiver_id": str(target_id)},
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/chat/send-request/",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 201, 400, 401, 403, 404):
                resp.success()
            else:
                resp.failure(f"Connect req {resp.status_code}")
