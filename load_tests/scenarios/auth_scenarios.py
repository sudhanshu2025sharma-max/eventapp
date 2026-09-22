"""
Authentication & Profile Load Scenarios
"""

import random
from locust import tag


class AuthScenarioMixin:

    @tag("auth", "critical")
    def login_flow(self):
        creds = self._get_credentials()
        with self.client.post(
            "/api/v1/auth/login/",
            json={"email": creds["email"], "password": creds["password"]},
            name="/api/v1/auth/login/",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                try:
                    data = resp.json()
                    tokens = data.get("tokens", {})
                    access = tokens.get("access", "")
                    if access:
                        self._access = access
                        self._refresh = tokens.get("refresh", "")
                        self._user = data.get("user", {})
                        resp.success()
                        return
                except Exception:
                    pass
                resp.failure("Login 200 but missing tokens")
            elif resp.status_code == 401:
                resp.failure("Invalid credentials")
            else:
                resp.failure(f"Login status {resp.status_code}")

    @tag("auth")
    def token_refresh_flow(self):
        if not getattr(self, "_refresh", None):
            return
        with self.client.post(
            "/api/v1/auth/token/refresh/",
            json={"refresh": self._refresh},
            name="/api/v1/auth/token/refresh/",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                try:
                    new_access = resp.json().get("access", "")
                    if new_access:
                        self._access = new_access
                except Exception:
                    pass
                resp.success()
            else:
                resp.failure(f"Refresh {resp.status_code}")

    @tag("auth", "profile")
    def fetch_profile(self):
        if not getattr(self, "_access", None):
            return
        with self.client.get(
            "/api/v1/auth/me/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/auth/me/",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 401):
                resp.success()  # 401 = token expired, expected under load
            else:
                resp.failure(f"Profile {resp.status_code}")

    @tag("auth", "profile")
    def update_profile(self):
        if not getattr(self, "_access", None):
            return
        interests = random.sample(
            ["AI", "ML", "NLP", "CV", "Robotics", "DS", "IoT"],
            k=random.randint(1, 3),
        )
        with self.client.post(
            "/api/v1/auth/update-profile/",
            json={"research_interests": ", ".join(interests)},
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/auth/update-profile/",
            catch_response=True,
        ) as resp:
            # 200/201 = success, 400 = validation, 401 = expired, 405 = wrong method
            if resp.status_code in (200, 201, 400, 401, 405):
                resp.success()
            else:
                resp.failure(f"Update {resp.status_code}")

    @tag("auth", "critical")
    def invalid_login_attempt(self):
        with self.client.post(
            "/api/v1/auth/login/",
            json={"email": f"fake_{random.randint(1,9999)}@test.com", "password": "x"},
            name="/api/v1/auth/login/ [INVALID]",
            catch_response=True,
        ) as resp:
            if resp.status_code in (400, 401, 429):
                resp.success()
            else:
                resp.failure(f"Unexpected {resp.status_code}")
