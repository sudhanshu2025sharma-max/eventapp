import requests
import logging
from copy import deepcopy
from .models import DeviceToken, UserNotification, PushDelivery

logger = logging.getLogger(__name__)
EXPO_URL = "https://exp.host/--/api/v2/push/send"

def _cover_url(notif, request=None):
    if not notif or not getattr(notif, 'cover_image', None): 
        return None
    try:
        if request: 
            return request.build_absolute_uri(notif.cover_image.url)
        return notif.cover_image.url
    except Exception: 
        return None

def _target_users(target_type, target_role, target_user):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    if target_type == 'all': 
        return User.objects.filter(is_active=True)
    elif target_type == 'role' and target_role: 
        return User.objects.filter(is_active=True, role=target_role)
    elif target_type == 'user' and target_user: 
        return User.objects.filter(pk=target_user.pk)
    return User.objects.none()

def _create_rows(notif, users):
    if not notif: 
        return
    rows = [UserNotification(user=u, notification=notif) for u in users]
    UserNotification.objects.bulk_create(rows, ignore_conflicts=True)

def _send_expo(tokens, title, body, data, img=None, notif=None):
    if not tokens: 
        return 0, 0, []
    success = failed = 0
    bad_tokens = []
    proxies = {
        'http': 'http://proxy21.iitd.ac.in:3128',
        'https': 'http://proxy21.iitd.ac.in:3128',
    }
    session = requests.Session()
    session.verify = False
    import urllib3
    urllib3.disable_warnings()

    # Expo accepts at most 100 messages per request.
    for offset in range(0, len(tokens), 100):
        batch = tokens[offset:offset + 100]
        msgs = []
        for token in batch:
            payload = {
                "to": token, "title": title, "body": body,
                "data": deepcopy(data or {}), "sound": "default", "priority": "high",
                "channelId": "default",
            }
            if (data or {}).get("type") in ("new_message", "connection_request"):
                payload["channelId"] = "chat"
            if img:
                payload["data"]["cover_image"] = img
            msgs.append(payload)

        resp = None
        try:
            resp = session.post(
                EXPO_URL, json=msgs,
                headers={'Accept': 'application/json', 'Content-Type': 'application/json'},
                proxies=proxies, timeout=30,
            )
            resp.raise_for_status()
            response = resp.json()
            tickets = response.get('data') if isinstance(response, dict) else None
            if not isinstance(tickets, list) or len(tickets) != len(batch):
                raise ValueError('Expo returned an invalid ticket list')
        except Exception as exc:
            logger.exception('Expo push request failed (batch=%s, http_status=%s)', len(batch), getattr(resp, 'status_code', None))
            failed += len(batch)
            PushDelivery.objects.bulk_create([
                PushDelivery(notification=notif, platform='expo', token=token,
                             status='failed', error=str(exc)[:1000])
                for token in batch
            ])
            continue

        for token, ticket in zip(batch, tickets):
            if isinstance(ticket, dict) and ticket.get('status') == 'ok' and ticket.get('id'):
                success += 1
                PushDelivery.objects.create(
                    notification=notif, platform='expo', token=token,
                    ticket_id=ticket['id'], status='accepted',
                )
            else:
                failed += 1
                details = ticket.get('details') if isinstance(ticket, dict) else None
                details = details if isinstance(details, dict) else {}
                error = details.get('error') or (ticket.get('message') if isinstance(ticket, dict) else 'Invalid Expo ticket') or 'Invalid Expo ticket'
                logger.warning('Expo rejected push ticket (error=%s)', error)
                if details.get('error') == 'DeviceNotRegistered':
                    bad_tokens.append(token)
                PushDelivery.objects.create(
                    notification=notif, platform='expo', token=token,
                    status='failed', error=str(error)[:1000],
                )
    return success, failed, bad_tokens

def _send_hybrid(tokens, title, body, data=None, img=None, notif=None):
    """Compatibility entry point used by existing native push callers."""
    if not tokens:
        return 0, 0, []
    expo_tokens = [token for token in tokens if 'Expo' in token or 'Exponent' in token]
    unsupported_tokens = [token for token in tokens if token not in expo_tokens]
    if unsupported_tokens:
        logger.error('Push dispatch found %s active token(s) with an unsupported provider format', len(unsupported_tokens))
        PushDelivery.objects.bulk_create([
            PushDelivery(notification=notif, platform='expo', token=token,
                         status='failed', error='Unsupported push token format')
            for token in unsupported_tokens
        ])
    expo_ok, expo_failed, bad = _send_expo(expo_tokens, title, body, data or {}, img, notif)
    expo_failed += len(unsupported_tokens)
    if bad:
        DeviceToken.objects.filter(token__in=bad).update(is_active=False)
    return expo_ok, expo_failed, bad


def _dispatch(users, title, body, data=None, notif=None, request=None):
    if notif:
        _create_rows(notif, users)
    user_ids = users.values_list('pk', flat=True)
    tokens = list(DeviceToken.objects.filter(is_active=True, user_id__in=user_ids).values_list('token', flat=True))
    img = _cover_url(notif, request)
    success, failed, bad = _send_hybrid(tokens, title, body, data or {}, img, notif)
    if not tokens:
        logger.warning('Push has no registered native destinations (notification_id=%s)', getattr(notif, 'id', None))
    if notif:
        notif.status = 'sent' if success else 'failed'
        notif.sent_count = success
        notif.failed_count = failed
        notif.save(update_fields=['status', 'sent_count', 'failed_count'])
    return success, failed, bad

# --- EXPORTED DISPATCHERS ---

def send_to_tokens(tokens, title, body, data=None, img=None):
    return _send_hybrid(tokens, title, body, data or {}, img)

def send_to_user(user, title, body, data=None, notif=None, request=None):
    """Send push notification to a specific user"""
    users = _target_users('user', '', user)
    return _dispatch(users, title, body, data, notif, request)

def send_to_role(*args, **kwargs):
    role = args[0] if len(args) > 0 else kwargs.get('role', '')
    title = args[1] if len(args) > 1 else kwargs.get('title', '')
    body = args[2] if len(args) > 2 else kwargs.get('body', '')
    data = args[3] if len(args) > 3 else kwargs.get('data', {})
    notif = args[4] if len(args) > 4 else kwargs.get('notif', None)
    request = kwargs.get('request', None)

    users = _target_users('role', role, None)
    return _dispatch(users, title, body, data, notif, request)

def send_to_all(*args, **kwargs):
    request = kwargs.get('request', None)
    if len(args) == 1 or (len(args) == 2 and not isinstance(args[0], str)):
        notif = args[0]
        request = args[1] if len(args) > 1 else request
        title = notif.title
        body = notif.body
        data = notif.data or {}
    else:
        title = args[0] if len(args) > 0 else kwargs.get('title', '')
        body = args[1] if len(args) > 1 else kwargs.get('body', '')
        data = args[2] if len(args) > 2 else kwargs.get('data', {})
        notif = args[3] if len(args) > 3 else kwargs.get('notif', None)

    users = _target_users('all', '', None)
    return _dispatch(users, title, body, data, notif, request)

def send_notification(notif, request=None):
    """Wrapper method for a Notification object"""
    if notif.target_type == 'all':
        return send_to_all(notif, request=request)
    elif notif.target_type == 'role':
        return send_to_role(notif.target_role, notif.title, notif.body, notif.data or {}, notif, request=request)
    elif notif.target_type == 'user' and notif.target_user:
        return send_to_user(notif.target_user, notif.title, notif.body, notif.data or {}, notif, request=request)
    return 0, 0, []
