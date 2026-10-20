from django.core.management.base import BaseCommand
from django.db.models import Count
from apps.notifications.models import DeviceToken, PushDelivery


class Command(BaseCommand):
    help = 'Show push readiness and provider result counts without printing tokens or private keys.'

    def add_arguments(self, parser):
        parser.add_argument('--email', help='Optionally inspect native registrations for one account.')

    def handle(self, *args, **options):
        devices = DeviceToken.objects.all()
        if options.get('email'):
            devices = devices.filter(user__email__iexact=options['email'])
        for platform in ('android', 'ios'):
            self.stdout.write(f"{platform} active devices: {devices.filter(platform=platform, is_active=True).count()}")
            self.stdout.write(f"{platform} inactive devices: {devices.filter(platform=platform, is_active=False).count()}")
        self.stdout.write('Provider receipts below cover all accounts. A successful receipt does not prove that an alert was displayed.')
        for row in PushDelivery.objects.values('platform', 'status').annotate(count=Count('id')).order_by('platform', 'status'):
            self.stdout.write(f"{row['platform']} {row['status']}: {row['count']}")
        codes = ['DeviceNotRegistered', 'InvalidCredentials', 'MismatchSenderId', 'SENDER_ID_MISMATCH', 'UNREGISTERED']
        for code in codes:
            count = PushDelivery.objects.filter(status='failed', error__icontains=code).count()
            if count:
                self.stdout.write(f'{code}: {count}')
