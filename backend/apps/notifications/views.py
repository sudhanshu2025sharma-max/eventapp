from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from .models import UserNotification, Notification, DeviceToken, WebPushSubscription, PushDelivery
from django.conf import settings
from urllib.parse import urlsplit
from uuid import UUID
from django.db.models import Count, Q
from django.utils import timezone
import importlib.util
from apps.checkins.meal_utils import sync_meal_window
from . import fcm

from django.core.cache import cache

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def unread_count(request):
    # Only evaluate schedule-driven meal windows at most once every 60s across requests
    if cache.add('meal_window_sync_lock', 1, 60):
        try:
            sync_meal_window()
        except Exception:
            pass

    count = UserNotification.objects.filter(user=request.user, read=False).count()
    return Response({'unread_count': count})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_notifications(request):
    notifs = UserNotification.objects.filter(user=request.user).select_related('notification').prefetch_related('notification__attachments').order_by('-created_at')[:50]
    results = []
    for un in notifs:
        n = un.notification
        results.append({
            'id': str(n.id),
            'notification_id': str(n.id),  # Published Android clients use this field.
            'title': n.title,
            'body': n.body,
            'data': n.data,
            'delivered_at': un.delivered_at.isoformat() if un.delivered_at else None,
            'read': un.read,
            'created_at': n.created_at.isoformat(),
            'cover_image_url': request.build_absolute_uri(n.cover_image.url) if n.cover_image else None,
            'attachments': [{'id': a.id, 'filename': a.filename, 'url': request.build_absolute_uri(a.file.url)} for a in n.attachments.all()],
        })
    unread = UserNotification.objects.filter(user=request.user, read=False).count()
    return Response({'notifications': results, 'unread_count': unread})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def register_token(request):
    token = request.data.get('token')
    platform = request.data.get('platform', 'android')
    if token:
        # Tokens identify installations, not accounts. Rebind when a phone changes user.
        DeviceToken.objects.update_or_create(
            token=token,
            defaults={'user': request.user, 'platform': platform, 'is_active': True}
        )
        return Response({'success': True})
    return Response({'error': 'Token required'}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def register_device_token(request):
    return register_token(request)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def web_push_config(request):
    ready = bool(settings.WEBPUSH_VAPID_PUBLIC_KEY and settings.WEBPUSH_VAPID_PRIVATE_KEY and importlib.util.find_spec('pywebpush'))
    return Response({'public_key': settings.WEBPUSH_VAPID_PUBLIC_KEY if ready else '', 'enabled': ready})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def web_push_subscribe(request):
    subscription = request.data.get('subscription') or {}
    if not isinstance(subscription, dict):
        return Response({'error': 'A valid browser push subscription is required.'}, status=400)
    endpoint = subscription.get('endpoint')
    keys = subscription.get('keys') or {}
    if not isinstance(keys, dict):
        return Response({'error': 'Invalid subscription keys.'}, status=400)
    p256dh, auth = keys.get('p256dh'), keys.get('auth')
    if not endpoint or not p256dh or not auth:
        return Response({'error': 'A valid browser push subscription is required.'}, status=status.HTTP_400_BAD_REQUEST)
    if not isinstance(endpoint, str) or len(endpoint) > 2048:
        return Response({'error': 'Unsupported browser push endpoint.'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        parsed_endpoint = urlsplit(endpoint)
        hostname = (parsed_endpoint.hostname or '').lower()
        endpoint_port = parsed_endpoint.port
    except ValueError:
        return Response({'error': 'Unsupported browser push endpoint.'}, status=status.HTTP_400_BAD_REQUEST)
    allowed_push_hosts = {
        'fcm.googleapis.com',
        'web.push.apple.com',
        'updates.push.services.mozilla.com',
    }
    allowed = parsed_endpoint.scheme == 'https' and endpoint_port in (None, 443) and (
        hostname in allowed_push_hosts or hostname.endswith('.notify.windows.com')
    )
    if not allowed:
        return Response({'error': 'Unsupported browser push endpoint.'}, status=status.HTTP_400_BAD_REQUEST)
    obj, _ = WebPushSubscription.objects.update_or_create(
        endpoint=endpoint,
        defaults={'user': request.user, 'p256dh': p256dh, 'auth': auth, 'is_active': True},
    )
    return Response({'success': True, 'subscription_id': obj.pk})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def web_push_unsubscribe(request):
    endpoint = (request.data.get('endpoint') or '').strip()
    if endpoint:
        WebPushSubscription.objects.filter(user=request.user, endpoint=endpoint).update(is_active=False)
    return Response({'success': True})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def unregister_token(request):
    token = request.data.get('token')
    if token:
        DeviceToken.objects.filter(user=request.user, token=token).update(is_active=False)
    return Response({'success': True})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_read(request):
    notif_id = request.data.get('notification_id') or request.data.get('id')
    ids = [notif_id] if notif_id else request.data.get('notification_ids', [])
    if not isinstance(ids, list) or len(ids) > 100:
        return Response({'error': 'Provide up to 100 notification IDs.'}, status=400)
    try:
        ids = [UUID(str(value)) for value in ids]
    except (ValueError, TypeError, AttributeError):
        return Response({'error': 'Invalid notification ID.'}, status=400)
    if ids:
        UserNotification.objects.filter(user=request.user, notification_id__in=ids).update(read=True, read_at=timezone.now())
    return Response({'success': True})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_all_read(request):
    UserNotification.objects.filter(user=request.user, read=False).update(read=True)
    return Response({'success': True})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_notification(request):
    if getattr(request.user, 'role', '') not in ['super_admin', 'mgmt_admin', 'team_head', 'staff']:
        return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)
    
    title = request.data.get('title')
    body = request.data.get('body')
    target_type = request.data.get('target_type', 'all')
    
    if not title or not body:
        return Response({'error': 'Title and body required'}, status=status.HTTP_400_BAD_REQUEST)

    notif = Notification.objects.create(
        title=title, body=body, target_type=target_type, sent_by=request.user, status='pending'
    )
    if target_type == 'all':
        sent, failed, _bad = fcm.send_to_all(notif)
    elif target_type == 'role':
        notif.target_role = request.data.get('target_role', '')
        notif.save(update_fields=['target_role'])
        sent, failed, _bad = fcm.send_to_role(notif.target_role, title, body, notif.data or {}, notif)
    elif target_type == 'user':
        user_id = request.data.get('target_user')
        notif.target_user_id = user_id
        notif.save(update_fields=['target_user'])
        sent, failed, _bad = fcm.send_to_user(notif.target_user, title, body, notif.data or {}, notif)
    else:
        notif.status = 'failed'
        notif.save(update_fields=['status'])
        return Response({'error': 'Unsupported target type.'}, status=status.HTTP_400_BAD_REQUEST)
    return Response({
        'success': sent > 0, 'notification_id': str(notif.id),
        'sent_count': sent, 'failed_count': failed, 'status': notif.status,
        'error': None if sent else ('No registered devices for this audience. The notice is available in their inbox.' if not failed else 'No push provider accepted this notification.'),
    }, status=status.HTTP_200_OK if sent else status.HTTP_502_BAD_GATEWAY)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def notification_history(request):
    if getattr(request.user, 'role', '') not in ['super_admin', 'mgmt_admin', 'team_head', 'staff']:
        return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)
    notifs = Notification.objects.annotate(receipt_count=Count('push_deliveries', filter=Q(push_deliveries__status='delivered'))).order_by('-created_at')[:50]
    results = [{
        'id': str(n.id), 'title': n.title, 'body': n.body,
        'target_type': n.target_type, 'status': n.status,
        'sent_count': n.sent_count, 'failed_count': n.failed_count,
        'delivered_count': n.receipt_count,
        'created_at': n.created_at.isoformat()
    } for n in notifs]
    device_count = DeviceToken.objects.filter(is_active=True).count() + WebPushSubscription.objects.filter(is_active=True).count()
    return Response({'notifications': results, 'device_count': device_count})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def notification_detail(request, pk):
    notif = get_object_or_404(Notification, pk=pk)
    return Response({
        'id': str(notif.id), 'title': notif.title, 'body': notif.body,
        'target_type': notif.target_type, 'status': notif.status,
        'sent_count': notif.sent_count, 'failed_count': notif.failed_count,
        'delivered_count': PushDelivery.objects.filter(notification=notif, status='delivered').count(),
        'created_at': notif.created_at.isoformat()
    })
