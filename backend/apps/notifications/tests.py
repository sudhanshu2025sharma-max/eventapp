from unittest.mock import MagicMock, patch

import requests
from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TestCase, override_settings
from rest_framework.test import APIRequestFactory, force_authenticate

from . import fcm, views
from .models import Notification, UserNotification, DeviceToken
from .admin_views import notifications_page
from django.test import RequestFactory


class ExpoSendTests(SimpleTestCase):
    @patch.object(fcm.PushDelivery.objects, 'create')
    @patch('apps.notifications.fcm.requests.Session')
    def test_batches_and_explicit_android_channel(self, session, create):
        def reply(*args, **kwargs):
            response = MagicMock()
            response.json.return_value = {'data': [{'status': 'ok', 'id': f'ticket-{i}'} for i, _ in enumerate(kwargs['json'])]}
            return response
        session.return_value.post.side_effect = reply
        result = fcm._send_expo([f'ExponentPushToken[{i}]' for i in range(205)], 'Title', 'Body', {})
        self.assertEqual(result, (205, 0, []))
        self.assertEqual([len(call.kwargs['json']) for call in session.return_value.post.call_args_list], [100, 100, 5])
        self.assertEqual(session.return_value.post.call_args_list[0].kwargs['json'][0]['channelId'], 'default')
        self.assertEqual(create.call_count, 205)

    @patch.object(fcm.PushDelivery.objects, 'bulk_create')
    @patch('apps.notifications.fcm.requests.Session')
    def test_http_error_and_empty_response_are_failures(self, session, create):
        response = session.return_value.post.return_value
        response.raise_for_status.side_effect = requests.HTTPError('provider unavailable')
        self.assertEqual(fcm._send_expo(['ExponentPushToken[test]'], 'T', 'B', {}), (0, 1, []))
        response.raise_for_status.side_effect = None
        response.json.return_value = {'data': []}
        self.assertEqual(fcm._send_expo(['ExponentPushToken[test]'], 'T', 'B', {}), (0, 1, []))
        self.assertEqual(create.call_count, 2)

    @patch.object(fcm.PushDelivery.objects, 'create')
    @patch('apps.notifications.fcm.requests.Session')
    def test_invalid_device_and_malformed_error_details(self, session, create):
        session.return_value.post.return_value.json.return_value = {'data': [
            {'status': 'error', 'details': {'error': 'DeviceNotRegistered'}},
            {'status': 'error', 'details': ['invalid']},
        ]}
        self.assertEqual(fcm._send_expo(['ExponentPushToken[a]', 'ExponentPushToken[b]'], 'T', 'B', {}), (0, 2, ['ExponentPushToken[a]']))


class InboxCompatibilityTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        User = get_user_model()
        cls.user = User.objects.create_user(email='notification-test@example.invalid', password='test-only-password')
        cls.other = User.objects.create_user(email='other-test@example.invalid', password='test-only-password')
        cls.notification = Notification.objects.create(title='Inbox test', body='Body')
        UserNotification.objects.create(user=cls.user, notification=cls.notification)
        UserNotification.objects.create(user=cls.other, notification=cls.notification)

    def request(self, path, data=None):
        factory = APIRequestFactory()
        request = factory.post(path, data, format='json') if data is not None else factory.get(path)
        force_authenticate(request, user=self.user)
        return request

    def test_inbox_has_ids_for_published_android_and_web(self):
        with self.assertNumQueries(3):
            response = views.my_notifications(self.request('/api/v1/notifications/my/'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['notifications'][0]['id'], str(self.notification.id))
        self.assertEqual(response.data['notifications'][0]['notification_id'], str(self.notification.id))
        self.assertEqual(response.data['unread_count'], 1)

    def test_android_plural_read_payload_only_changes_own_inbox(self):
        response = views.mark_read(self.request('/api/v1/notifications/mark-read/', {'notification_ids': [str(self.notification.id)]}))
        self.assertEqual(response.status_code, 200)
        self.assertTrue(UserNotification.objects.get(user=self.user).read)
        self.assertFalse(UserNotification.objects.get(user=self.other).read)

    def test_web_singular_read_payload_and_invalid_ids(self):
        response = views.mark_read(self.request('/api/v1/notifications/mark-read/', {'notification_id': str(self.notification.id)}))
        self.assertEqual(response.status_code, 200)
        response = views.mark_read(self.request('/api/v1/notifications/mark-read/', {'notification_ids': ['invalid']}))
        self.assertEqual(response.status_code, 400)

    def test_admin_notification_page_uses_bounded_queries(self):
        Notification.objects.bulk_create([Notification(title=f'Notice {i}', body='Body') for i in range(20)])
        self.user.role = 'super_admin'
        request = RequestFactory().get('/panel/notifications/')
        request.user = self.user
        with self.assertNumQueries(4):
            response = notifications_page(request)
        self.assertEqual(response.status_code, 200)

    def test_sign_in_reassigns_an_existing_installation_token(self):
        token = 'ExponentPushToken[test-installation]'
        DeviceToken.objects.create(user=self.other, token=token, platform='android')
        response = views.register_token(self.request('/api/v1/notifications/tokens/', {'token': token, 'platform': 'android'}))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(DeviceToken.objects.filter(token=token).count(), 1)
        self.assertEqual(DeviceToken.objects.get(token=token).user_id, self.user.id)
