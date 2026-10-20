from django.core.management.base import BaseCommand
from apps.notifications.tasks import collect_expo_push_receipts


class Command(BaseCommand):
    help = 'Collect Expo provider receipts for existing tickets; does not send notifications.'

    def handle(self, *args, **options):
        result = collect_expo_push_receipts.run()
        self.stdout.write(f"Checked {result['checked']} receipts: {result['delivered']} provider-accepted, {result['failed']} failed.")
