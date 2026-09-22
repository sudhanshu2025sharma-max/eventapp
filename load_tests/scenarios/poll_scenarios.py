"""Poll Voting Scenarios"""
import random
from locust import tag


class PollScenarioMixin:

    @tag("polls", "read")
    def list_polls(self):
        if not getattr(self, "_access", None):
            return
        with self.client.get(
            "/api/v1/polls/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/polls/",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                try:
                    data = resp.json()
                    polls = data if isinstance(data, list) else data.get("results", data.get("polls", []))
                    if isinstance(polls, list):
                        self._polls = polls
                except Exception:
                    pass
                resp.success()
            elif resp.status_code in (401, 403, 404):
                resp.success()
            else:
                resp.failure(f"Polls {resp.status_code}")

    @tag("polls", "write")
    def vote_on_poll(self):
        if not getattr(self, "_access", None):
            return
        polls = getattr(self, "_polls", [])
        if not polls:
            return
        poll = random.choice(polls)
        poll_id = poll.get("id", "")
        options = poll.get("options", [])
        if not poll_id or not options:
            return
        option_id = random.choice(options).get("id", "")
        if not option_id:
            return
        with self.client.post(
            f"/api/v1/polls/{poll_id}/vote/",
            json={"option_id": option_id},
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/polls/[id]/vote/",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 201, 400, 401, 403, 404):
                resp.success()
            else:
                resp.failure(f"Vote {resp.status_code}")
