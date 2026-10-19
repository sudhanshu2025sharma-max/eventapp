"""Registration changes commit before push delivery starts."""
import logging
from datetime import timedelta
from threading import Thread

from django.core.cache import cache
from django.db import close_old_connections, transaction
from django.utils import timezone

from apps.notifications.models import Notification
from .ideathon_models import IdeathonConfig

logger = logging.getLogger(__name__)
EVENT = 'ideathon_registration_open'


def deliver_registration_notification(notification_id):
    close_old_connections()
    lock = f'ideathon:notification:{notification_id}'
    acquired = False
    try:
        acquired = cache.add(lock, True, timeout=120)
        if not acquired:
            return
        notification = Notification.objects.filter(
            pk=notification_id, status='pending', data__event=EVENT).first()
        if notification:
            from apps.notifications.fcm import send_to_all
            # send_to_all owns delivery status and counts, including failures.
            send_to_all(notification)
    except Exception:
        logger.exception('Ideathon notification delivery failed: %s', notification_id)
        Notification.objects.filter(pk=notification_id, status='pending').update(status='failed')
    finally:
        if acquired:
            cache.delete(lock)
        close_old_connections()


def _start_delivery(notification_id):
    try:
        Thread(target=deliver_registration_notification, args=(notification_id,), daemon=True).start()
    except Exception:
        # The periodic reminder worker also recovers pending deliveries.
        logger.exception('Could not start Ideathon notification delivery')


def queue_registration_notification(config, user):
    notification = Notification.objects.create(
        title='🏆 Ideathon Team Registration is Open!',
        body=f'Form your teams now in the app. Teams of {config.min_team_size}–{config.max_team_size} members.',
        target_type='all', sent_by=user, status='pending',
        data={'type': 'poll', 'event': EVENT},
    )
    transaction.on_commit(lambda: _start_delivery(str(notification.pk)))


@transaction.atomic
def set_registration(user, desired=None):
    IdeathonConfig.get()
    config = IdeathonConfig.objects.select_for_update().get(pk=1)
    was_open = config.registration_open
    config.registration_open = not was_open if desired is None else desired
    config.updated_by = user
    config.save()
    if config.registration_open and not was_open:
        queue_registration_notification(config, user)
    return config


def recover_registration_notifications():
    pending = Notification.objects.filter(
        status='pending', data__event=EVENT,
        created_at__lt=timezone.now() - timedelta(minutes=1),
    ).values_list('pk', flat=True)[:10]
    for notification_id in pending:
        deliver_registration_notification(notification_id)
