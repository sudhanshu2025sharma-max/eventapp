import requests
import logging
from django.conf import settings
from .models import DeviceToken, UserNotification

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

def _send_expo(tokens, title, body, data, img=None):
    if not tokens: 
        return 0, 0, []
    msgs = []
    for t in tokens:
        m = {
            "to": t, 
            "title": title, 
            "body": body,
            "data": data or {}, 
            "sound": "default", 
            "priority": "high",
        }
        if (data or {}).get("type") in ("new_message", "connection_request"): 
            m["channelId"] = "chat"
        if img: 
            m["data"]["cover_image"] = img
        msgs.append(m)
    try:
        proxies = {
            'http': 'http://proxy21.iitd.ac.in:3128',
            'https': 'http://proxy21.iitd.ac.in:3128',
        }
        session = requests.Session()
        session.verify = False
        import urllib3
        urllib3.disable_warnings()
        resp = session.post(
            EXPO_URL, 
            json=msgs, 
            headers={'Accept':'application/json','Content-Type':'application/json'}, 
            proxies=proxies, 
            timeout=30
        )
        r = resp.json()
        
        bad_tokens = []
        success = 0
        failed = 0
        data_list = r.get('data', []) if isinstance(r, dict) else []
        for idx, item in enumerate(data_list):
            if isinstance(item, dict) and item.get('status') == 'ok': 
                success += 1
            else:
                failed += 1
                if isinstance(item, dict) and item.get('details', {}).get('error') == 'DeviceNotRegistered':
                    if idx < len(tokens): 
                        bad_tokens.append(tokens[idx])
        return success, failed, bad_tokens
    except Exception as e:
        logger.error(f"Expo push err: {e}")
        return 0, len(tokens), []

def _send_fcm(tokens, title, body, data, img=None):
    return 0, 0, []

def _send_hybrid(tokens, title, body, data, img=None):
    # Match both ExponentPushToken[...] and ExpoPushToken[...] or any Expo token
    expo = [t for t in tokens if 'Expo' in t or 'Exponent' in t]
    fcm_tokens = [t for t in tokens if 'Expo' not in t and 'Exponent' not in t]
    s1, f1, b1 = _send_expo(expo, title, body, data, img)
    s2, f2, b2 = _send_fcm(fcm_tokens, title, body, data, img)
    return s1 + s2, f1 + f2, b1 + b2

# --- EXPORTED DISPATCHERS ---

def send_to_tokens(tokens, title, body, data=None, img=None):
    if not tokens: 
        return 0, 0, []
    return _send_hybrid(tokens, title, body, data or {}, img)

def send_to_user(user, title, body, data=None, notif=None, request=None):
    """Send push notification to a specific user"""
    users = _target_users('user', '', user)
    if notif: 
        _create_rows(notif, users)
    tokens = list(DeviceToken.objects.filter(is_active=True, user=user).values_list('token', flat=True))
    s, f, bad = _send_hybrid(tokens, title, body, data or {}, _cover_url(notif, request))
    if notif:
        if bad: 
            DeviceToken.objects.filter(token__in=bad).update(is_active=False)
        notif.status = 'sent' if s > 0 or not tokens else 'failed'
        notif.sent_count = s
        notif.failed_count = f
        notif.save(update_fields=['status', 'sent_count', 'failed_count'])
    return s, f, bad

def send_to_role(*args, **kwargs):
    role = args[0] if len(args) > 0 else kwargs.get('role', '')
    title = args[1] if len(args) > 1 else kwargs.get('title', '')
    body = args[2] if len(args) > 2 else kwargs.get('body', '')
    data = args[3] if len(args) > 3 else kwargs.get('data', {})
    notif = args[4] if len(args) > 4 else kwargs.get('notif', None)
    request = kwargs.get('request', None)

    users = _target_users('role', role, None)
    if notif: 
        _create_rows(notif, users)
    tokens = list(DeviceToken.objects.filter(is_active=True, user__in=users).values_list('token', flat=True))
    s, f, bad = _send_hybrid(tokens, title, body, data, _cover_url(notif, request))
    if notif:
        if bad: 
            DeviceToken.objects.filter(token__in=bad).update(is_active=False)
        notif.status = 'sent' if s > 0 or not tokens else 'failed'
        notif.sent_count = s
        notif.failed_count = f
        notif.save(update_fields=['status', 'sent_count', 'failed_count'])
    return s, f, bad

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
    if notif: 
        _create_rows(notif, users)

    tokens = list(DeviceToken.objects.filter(is_active=True, user__in=users).values_list('token', flat=True))
    s, f, bad = _send_hybrid(tokens, title, body, data, _cover_url(notif, request))
    
    if notif:
        if bad: 
            DeviceToken.objects.filter(token__in=bad).update(is_active=False)
        notif.status = 'sent' if s > 0 or not tokens else 'failed'
        notif.sent_count = s
        notif.failed_count = f
        notif.save(update_fields=['status', 'sent_count', 'failed_count'])

    return s, f, bad

def send_notification(notif, request=None):
    """Wrapper method for a Notification object"""
    if notif.target_type == 'all':
        return send_to_all(notif, request=request)
    elif notif.target_type == 'role':
        return send_to_role(notif.target_role, notif.title, notif.body, notif.data or {}, notif, request=request)
    elif notif.target_type == 'user' and notif.target_user:
        return send_to_user(notif.target_user, notif.title, notif.body, notif.data or {}, notif, request=request)
    return 0, 0, []
