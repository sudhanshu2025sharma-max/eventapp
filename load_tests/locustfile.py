"""
ETD 2026 Conference App — Production Load Test Suite
Master orchestrator combining all scenario behaviors

Usage:
  cd /home/baadalvm/eventapp/load_tests
  locust -f locustfile.py --headless -u 50 -r 5 -t 5m --host http://10.17.9.48:8000
"""

import random
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from locust import HttpUser, task, between, events, tag
from config import (
    ADMIN_USERS, STAFF_USERS, PARTICIPANT_USERS,
    WEIGHTS, REQUEST_TIMEOUT,
)
from scenarios.auth_scenarios import AuthScenarioMixin
from scenarios.schedule_scenarios import ScheduleScenarioMixin
from scenarios.chat_scenarios import ChatScenarioMixin
from scenarios.checkin_scenarios import CheckinScenarioMixin
from scenarios.photo_scenarios import PhotoScenarioMixin
from scenarios.poll_scenarios import PollScenarioMixin
from scenarios.staff_scenarios import StaffScenarioMixin
from scenarios.notification_scenarios import NotificationScenarioMixin
from scenarios.leaderboard_scenarios import LeaderboardScenarioMixin
from scenarios.sponsor_scenarios import SponsorScenarioMixin


# ─── User Pool ────────────────────────────────────────────────────
# Only use KNOWN working credentials. The DB has:
#   participant@test.com, speaker@test.com, test@test.com
#   100 dummy users at firstname.lastname@test.com (unknown exact names)
#   18 staff at library.iitd.ac.in / admin.iitd.ac.in
# We rotate among the 3 known participants + 3 staff + 1 admin = 7 users.
# This is realistic: load testing measures server throughput, not auth coverage.

KNOWN_PARTICIPANTS = [
    {"email": "participant@test.com", "password": "Test@1234"},
    {"email": "speaker@test.com", "password": "Test@1234"},
    {"email": "test@test.com", "password": "12345678"},
]

KNOWN_STAFF = STAFF_USERS + ADMIN_USERS  # from config.py

ALL_KNOWN_USERS = KNOWN_PARTICIPANTS + KNOWN_STAFF


class ConferenceParticipant(
    HttpUser,
    AuthScenarioMixin,
    ScheduleScenarioMixin,
    ChatScenarioMixin,
    CheckinScenarioMixin,
    PhotoScenarioMixin,
    PollScenarioMixin,
    StaffScenarioMixin,
    NotificationScenarioMixin,
    LeaderboardScenarioMixin,
    SponsorScenarioMixin,
):
    """
    Simulates a real conference attendee with realistic browsing patterns.
    """
    wait_time = between(1, 5)
    weight = 8  # 80% of virtual users are participants

    _access = None
    _refresh = None
    _user = {}
    _credentials = None

    def on_start(self):
        """Login on spawn using a known working account."""
        self._credentials = random.choice(KNOWN_PARTICIPANTS)
        self.login_flow()

    def _get_credentials(self):
        return self._credentials or random.choice(KNOWN_PARTICIPANTS)

    @task(WEIGHTS["browse_schedule"])
    def task_browse_schedule(self):
        self.browse_schedule()

    @task(WEIGHTS["view_notifications"])
    def task_view_notifications(self):
        self.list_notifications()

    @task(WEIGHTS["browse_sponsors"])
    def task_browse_sponsors(self):
        self.list_sponsors()

    @task(WEIGHTS["browse_speakers"])
    def task_browse_speakers(self):
        self.list_speakers()

    @task(WEIGHTS["view_leaderboard"])
    def task_view_leaderboard(self):
        self.view_leaderboard()

    @task(WEIGHTS["browse_photos"])
    def task_browse_photos(self):
        self.browse_photos()

    @task(WEIGHTS["vote_poll"])
    def task_vote_poll(self):
        self.vote_on_poll()

    @task(WEIGHTS["view_staff_directory"])
    def task_view_staff(self):
        self.browse_staff_directory()

    @task(WEIGHTS["chat_send_message"])
    def task_chat(self):
        action = random.choice([
            self.list_conversations,
            self.list_connection_requests,
        ])
        action()

    @task(3)
    def task_profile_actions(self):
        action = random.choice([
            self.fetch_profile,
            self.token_refresh_flow,
        ])
        action()

    @task(2)
    def task_discover(self):
        self.discover_users()

    @task(1)
    def task_recap(self):
        self.view_recap()

    @task(2)
    def task_sponsor_detail(self):
        self.view_sponsor_detail()

    @task(2)
    def task_speaker_detail(self):
        self.view_speaker_detail()

    @task(2)
    def task_staff_detail(self):
        self.view_staff_detail()

    @task(1)
    def task_session_detail(self):
        self.view_session_detail()

    @task(1)
    def task_bookmark(self):
        self.toggle_bookmark()

    @task(1)
    def task_checkpoints(self):
        self.list_checkpoints()

    @task(1)
    def task_network(self):
        self.network_list()


class StaffUser(
    HttpUser,
    AuthScenarioMixin,
    ScheduleScenarioMixin,
    ChatScenarioMixin,
    CheckinScenarioMixin,
    StaffScenarioMixin,
    NotificationScenarioMixin,
    LeaderboardScenarioMixin,
    SponsorScenarioMixin,
    PhotoScenarioMixin,
    PollScenarioMixin,
):
    """
    Simulates staff/team_head users doing admin work + normal browsing.
    """
    wait_time = between(2, 8)
    weight = 2  # 20% of virtual users are staff

    _access = None
    _refresh = None
    _user = {}
    _credentials = None

    def on_start(self):
        self._credentials = random.choice(KNOWN_STAFF)
        self.login_flow()

    def _get_credentials(self):
        return self._credentials or random.choice(KNOWN_STAFF)

    @task(10)
    def task_staff_group_chat(self):
        action = random.choice([
            self.staff_group_chat_read,
            self.staff_group_chat_send,
        ])
        action()

    @task(8)
    def task_checkin_admin(self):
        action = random.choice([
            self.checkin_list,
            self.checked_in_participants,
            self.meal_stats,
        ])
        action()

    @task(5)
    def task_notifications(self):
        self.list_notifications()

    @task(5)
    def task_schedule(self):
        self.browse_schedule()

    @task(3)
    def task_staff_admin(self):
        action = random.choice([
            self.browse_staff_directory,
            self.admin_staff_permissions,
            self.view_staff_detail,
        ])
        action()

    @task(3)
    def task_photos_admin(self):
        self.browse_photos()

    @task(2)
    def task_polls(self):
        self.list_polls()

    @task(2)
    def task_leaderboard(self):
        self.view_leaderboard()

    @task(1)
    def task_sponsors(self):
        self.list_sponsors()

    @task(3)
    def task_chat(self):
        self.list_conversations()

    @task(2)
    def task_profile(self):
        self.fetch_profile()


# ─── Event Listeners for Stats ────────────────────────────────────
@events.quitting.add_listener
def on_quitting(environment, **kwargs):
    """Print summary on exit."""
    stats = environment.runner.stats
    print("\n" + "=" * 80)
    print("ETD 2026 LOAD TEST SUMMARY")
    print("=" * 80)
    total = stats.total
    print(f"Total Requests:    {total.num_requests}")
    print(f"Total Failures:    {total.num_failures}")
    print(f"Error Rate:        {(total.num_failures / max(total.num_requests, 1)) * 100:.2f}%")
    print(f"Avg Response Time: {total.avg_response_time:.0f}ms")
    print(f"Median:            {total.median_response_time}ms")
    print(f"95th Percentile:   {total.get_response_time_percentile(0.95):.0f}ms")
    print(f"99th Percentile:   {total.get_response_time_percentile(0.99):.0f}ms")
    print(f"Max Response Time: {total.max_response_time:.0f}ms")
    print(f"Requests/sec:      {total.total_rps:.1f}")
    print("=" * 80)
