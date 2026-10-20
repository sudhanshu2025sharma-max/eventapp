import importlib.util
from django.conf import settings
from django.core.management.base import BaseCommand
from django.db.models import Count
from apps.notifications.models import DeviceToken, PushDelivery, WebPushSubscription


class Command(BaseCommand):
    help = 'Show push readiness and provider result counts without printing tokens or private keys.'

    def handle(self, *args, **options):
        self.stdout.write(f"Web Push dependency: {bool(importlib.util.find_spec('pywebpush'))}")
        self.stdout.write(f"VAPID public key configured: {bool(settings.WEBPUSH_VAPID_PUBLIC_KEY)}")
        self.stdout.write(f"VAPID private key configured: {bool(settings.WEBPUSH_VAPID_PRIVATE_KEY)}")
        self.stdout.write(f"Active native devices: {DeviceToken.objects.filter(is_active=True).count()}")
        self.stdout.write(f"Active browser subscriptions: {WebPushSubscription.objects.filter(is_active=True).count()}")
        for row in PushDelivery.objects.values('platform', 'status').annotate(count=Count('id')).order_by('platform', 'status'):
            self.stdout.write(f"{row['platform']} {row['status']}: {row['count']}")
        codes = ['DeviceNotRegistered', 'InvalidCredentials', 'MismatchSenderId', 'SENDER_ID_MISMATCH', 'UNREGISTERED', 'WebPushNotConfigured']
        for code in codes:
            count = PushDelivery.objects.filter(status='failed', error__icontains=code).count()
            if count:
                self.stdout.write(f'{code}: {count}')
