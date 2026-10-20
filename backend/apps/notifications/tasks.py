import logging

import requests
from celery import shared_task
from django.utils import timezone
from datetime import timedelta

from .models import DeviceToken, PushDelivery

logger = logging.getLogger(__name__)
EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts'


@shared_task
def collect_expo_push_receipts():
    """Resolve Expo tickets into delivery outcomes after the provider has processed them."""
    cutoff = timezone.now() - timedelta(minutes=15)
    tickets = list(PushDelivery.objects.filter(
        platform='expo', status='accepted', receipt_checked_at__isnull=True,
        created_at__lte=cutoff, ticket_id__gt='',
    ).order_by('created_at')[:1000])
    if not tickets:
        return {'checked': 0, 'delivered': 0, 'failed': 0}

    delivered = failed = 0
    proxies = {
        'http': 'http://proxy21.iitd.ac.in:3128',
        'https': 'http://proxy21.iitd.ac.in:3128',
    }
    for offset in range(0, len(tickets), 1000):
        batch = tickets[offset:offset + 1000]
        try:
            response = requests.post(
                EXPO_RECEIPTS_URL,
                json={'ids': [item.ticket_id for item in batch]},
                headers={'Accept': 'application/json', 'Content-Type': 'application/json'},
                proxies=proxies, timeout=30, verify=False,
            )
            response.raise_for_status()
            receipts = response.json().get('data', {})
            if not isinstance(receipts, dict):
                raise ValueError('Expo returned an invalid receipt map')
        except Exception:
            logger.exception('Expo receipt lookup failed (batch=%s)', len(batch))
            continue

        for ticket in batch:
            receipt = receipts.get(ticket.ticket_id)
            if not isinstance(receipt, dict):
                continue
            ticket.receipt_checked_at = timezone.now()
            if receipt.get('status') == 'ok':
                ticket.status = 'delivered'
                delivered += 1
            else:
                ticket.status = 'failed'
                details = receipt.get('details') or {}
                ticket.error = str(details.get('error') or receipt.get('message') or 'Expo delivery failed')[:1000]
                failed += 1
                if details.get('error') == 'DeviceNotRegistered':
                    DeviceToken.objects.filter(token=ticket.token).update(is_active=False)
            ticket.save(update_fields=['status', 'error', 'receipt_checked_at'])

    return {'checked': delivered + failed, 'delivered': delivered, 'failed': failed}
