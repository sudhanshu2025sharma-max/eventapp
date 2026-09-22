"""Staff Directory & Admin CRUD Scenarios"""
import random
from locust import tag


class StaffScenarioMixin:

    @tag("staff", "read")
    def browse_staff_directory(self):
        if not getattr(self, "_access", None):
            return
        with self.client.get(
            "/api/v1/auth/staff/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/auth/staff/",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                try:
                    data = resp.json()
                    staff = data if isinstance(data, list) else data.get("results", data.get("staff", []))
                    if isinstance(staff, list):
                        self._staff_list = staff
                except Exception:
                    pass
                resp.success()
            elif resp.status_code in (401, 404):
                resp.success()
            else:
                resp.failure(f"Staff dir {resp.status_code}")

    @tag("staff", "read")
    def view_staff_detail(self):
        if not getattr(self, "_access", None):
            return
        staff = getattr(self, "_staff_list", [])
        if not staff:
            return
        member = random.choice(staff)
        uid = member.get("user_id", member.get("id", ""))
        if not uid:
            return
        with self.client.get(
            f"/api/v1/auth/staff/{uid}/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/auth/staff/[uuid]/",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 401, 404):
                resp.success()
            else:
                resp.failure(f"Staff detail {resp.status_code}")

    @tag("staff", "admin")
    def admin_staff_permissions(self):
        if not getattr(self, "_access", None):
            return
        with self.client.get(
            "/api/v1/auth/staff/admin/permissions/",
            headers={"Authorization": f"Bearer {self._access}"},
            name="/api/v1/auth/staff/admin/permissions/",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 401, 403):
                resp.success()
            else:
                resp.failure(f"Perms {resp.status_code}")
