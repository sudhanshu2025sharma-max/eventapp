"""Sponsor & Speaker Browsing Scenarios"""
import random
from locust import tag


class SponsorScenarioMixin:

    @tag("sponsors", "read")
    def list_sponsors(self):
        if not getattr(self, "_access", None):
            return
        with self.client.get(
            "/api/v1/sponsors/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/sponsors/",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                try:
                    data = resp.json()
                    sponsors = data if isinstance(data, list) else data.get("results", data.get("sponsors", []))
                    if isinstance(sponsors, list):
                        self._sponsors = sponsors
                except Exception:
                    pass
                resp.success()
            elif resp.status_code in (401, 404):
                resp.success()
            else:
                resp.failure(f"Sponsors {resp.status_code}")

    @tag("sponsors", "read")
    def view_sponsor_detail(self):
        if not getattr(self, "_access", None):
            return
        sponsors = getattr(self, "_sponsors", [])
        if not sponsors:
            return
        sid = random.choice(sponsors).get("id", "")
        if not sid:
            return
        with self.client.get(
            f"/api/v1/sponsors/{sid}/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/sponsors/[id]/",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 401, 404):
                resp.success()
            else:
                resp.failure(f"Sponsor detail {resp.status_code}")

    @tag("speakers", "read")
    def list_speakers(self):
        if not getattr(self, "_access", None):
            return
        with self.client.get(
            "/api/v1/speakers/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/speakers/",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 401, 404):
                resp.success()
            else:
                resp.failure(f"Speakers {resp.status_code}")

    @tag("speakers", "read")
    def view_speaker_detail(self):
        if not getattr(self, "_access", None):
            return
        with self.client.get(
            "/api/v1/speakers/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/speakers/ [for detail]",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                try:
                    data = resp.json()
                    speakers = data if isinstance(data, list) else data.get("results", data.get("speakers", []))
                    if isinstance(speakers, list) and speakers:
                        sid = random.choice(speakers).get("id", "")
                        if sid:
                            self.client.get(
                                f"/api/v1/speakers/{sid}/",
                                headers={"Authorization": f"Bearer {self._access}"},
                                name="/api/v1/speakers/[id]/",
                            )
                except Exception:
                    pass
                resp.success()
            elif resp.status_code in (401, 404):
                resp.success()
            else:
                resp.failure(f"Speaker detail {resp.status_code}")

    @tag("discovery", "read")
    def discover_users(self):
        if not getattr(self, "_access", None):
            return
        with self.client.get(
            "/api/v1/auth/discover/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/auth/discover/",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 401, 404):
                resp.success()
            else:
                resp.failure(f"Discover {resp.status_code}")

    @tag("recap", "read")
    def view_recap(self):
        if not getattr(self, "_access", None):
            return
        with self.client.get(
            "/api/v1/auth/my-recap/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/auth/my-recap/",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 401, 404):
                resp.success()
            else:
                resp.failure(f"Recap {resp.status_code}")
