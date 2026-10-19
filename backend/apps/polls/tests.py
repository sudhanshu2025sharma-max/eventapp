from django.test import TestCase
from django.contrib.auth import get_user_model
from django.test import override_settings
from unittest.mock import patch
from rest_framework.test import APIClient

from apps.accounts.models import StaffPermission
from apps.notifications.models import Notification
from .ideathon_models import IdeathonConfig
from .registration import EVENT


@override_settings(CACHES={'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}})
class IdeathonPermissionTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.staff = User.objects.create_user('ideathon-staff@example.com', role='staff')
        self.participant = User.objects.create_user('ideathon-player@example.com')
        self.permission = StaffPermission.objects.create(user=self.staff, module='ideathon')
        IdeathonConfig.get()
        self.client = APIClient()
        self.client.force_authenticate(self.staff)

    def test_assigned_staff_can_open_and_retries_are_idempotent(self):
        with patch('apps.notifications.fcm.send_to_all') as push:
            for _ in range(2):
                response = self.client.post('/api/v1/polls/admin/ideathon/toggle/', {'registration_open': True}, format='json')
                self.assertEqual(response.status_code, 200, response.data)
                self.assertTrue(response.data['registration_open'])
            push.assert_not_called()
        self.assertEqual(Notification.objects.filter(data__event=EVENT).count(), 1)
        self.assertEqual(Notification.objects.get().status, 'pending')
        self.assertTrue(IdeathonConfig.get().registration_open)

    def test_unassigned_revoked_and_unrelated_permissions_rejected(self):
        self.permission.delete()
        StaffPermission.objects.create(user=self.staff, module='polls')
        self.assertEqual(self.client.post('/api/v1/polls/admin/ideathon/toggle/').status_code, 403)
        self.assertEqual(self.client.post('/api/v1/polls/admin/ideathon/teams/', {}, format='json').status_code, 403)
        self.assertFalse(IdeathonConfig.get().registration_open)

    def test_web_staff_can_view_and_toggle_without_waiting_for_push(self):
        self.client.force_login(self.staff)
        self.assertEqual(self.client.get('/panel/ideathon/').status_code, 200)
        with patch('apps.notifications.fcm.send_to_all') as push:
            response = self.client.post('/panel/ideathon/', {'action': 'toggle_registration'})
            self.assertEqual(response.status_code, 302)
            push.assert_not_called()
        self.assertTrue(IdeathonConfig.get().registration_open)
        self.permission.delete()
        self.assertEqual(self.client.get('/panel/ideathon/').status_code, 403)

    def test_background_delivery_starts_after_transaction_commit(self):
        with patch('apps.polls.registration._start_delivery') as start:
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.post('/api/v1/polls/admin/ideathon/toggle/', {'registration_open': True}, format='json')
                self.assertEqual(response.status_code, 200)
                start.assert_not_called()
            start.assert_called_once_with(str(Notification.objects.get().pk))

    def test_bad_state_and_poll_permissions_stay_separate(self):
        self.assertEqual(self.client.post('/api/v1/polls/admin/ideathon/toggle/', {'registration_open': 'yes'}, format='json').status_code, 400)
        self.assertEqual(self.client.get('/api/v1/polls/admin/list/').status_code, 403)
        StaffPermission.objects.create(user=self.staff, module='polls')
        self.assertEqual(self.client.get('/api/v1/polls/admin/list/').status_code, 200)

    def test_recovery_only_processes_registration_notifications(self):
        from datetime import timedelta
        from django.utils import timezone
        from .registration import recover_registration_notifications
        notice = Notification.objects.create(title='Registration', body='Open', data={'event': EVENT})
        Notification.objects.filter(pk=notice.pk).update(created_at=timezone.now() - timedelta(minutes=2))
        Notification.objects.create(title='Unsent draft', body='Do not send')
        with patch('apps.polls.registration.deliver_registration_notification') as delivery:
            recover_registration_notifications()
            delivery.assert_called_once_with(notice.pk)

    def test_failed_push_does_not_mark_notification_sent_or_close_registration(self):
        from apps.notifications.models import DeviceToken
        from .registration import deliver_registration_notification
        DeviceToken.objects.create(user=self.staff, token='test-push-token')
        self.client.post('/api/v1/polls/admin/ideathon/toggle/', {'registration_open': True}, format='json')
        notification = Notification.objects.get()
        with patch('apps.polls.registration.close_old_connections'), patch(
                'apps.notifications.fcm._send_hybrid', return_value=(0, 1, [])) as push:
            deliver_registration_notification(notification.pk)
            push.assert_called_once()
            deliver_registration_notification(notification.pk)
            push.assert_called_once()
        notification.refresh_from_db()
        self.assertEqual(notification.status, 'failed')
        self.assertEqual(notification.failed_count, 1)
        self.assertTrue(IdeathonConfig.get().registration_open)
