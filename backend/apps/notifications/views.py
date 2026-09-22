from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from .models import UserNotification, Notification, DeviceToken
from apps.checkins.meal_utils import sync_meal_window
from . import fcm

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def unread_count(request):
    # Continuously evaluate schedule-driven meal windows on global background poll
    try:
        sync_meal_window()
    except Exception:
        pass

    count = UserNotification.objects.filter(user=request.user, read=False).count()
    return Response({'unread_count': count})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_notifications(request):
    notifs = UserNotification.objects.filter(user=request.user).select_related('notification').order_by('-delivered_at')[:50]
    results = []
    for un in notifs:
        n = un.notification
        results.append({
            'id': str(n.id),
            'title': n.title,
            'body': n.body,
            'data': n.data,
            'delivered_at': un.delivered_at.isoformat() if un.delivered_at else None,
            'read': un.read,
        })
    return Response({'notifications': results})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def register_token(request):
    token = request.data.get('token')
    platform = request.data.get('platform', 'android')
    if token:
        DeviceToken.objects.update_or_create(
            user=request.user, token=token,
            defaults={'platform': platform, 'is_active': True}
        )
        return Response({'success': True})
    return Response({'error': 'Token required'}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def register_device_token(request):
    return register_token(request)

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
    if notif_id:
        UserNotification.objects.filter(user=request.user, notification_id=notif_id).update(read=True)
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
    fcm.send_to_all(notif)
    return Response({'success': True, 'notification_id': str(notif.id)})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def notification_history(request):
    if getattr(request.user, 'role', '') not in ['super_admin', 'mgmt_admin', 'team_head', 'staff']:
        return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)
    notifs = Notification.objects.all().order_by('-created_at')[:50]
    results = [{
        'id': str(n.id), 'title': n.title, 'body': n.body,
        'target_type': n.target_type, 'status': n.status,
        'sent_count': n.sent_count, 'created_at': n.created_at.isoformat()
    } for n in notifs]
    return Response({'notifications': results})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def notification_detail(request, pk):
    notif = get_object_or_404(Notification, pk=pk)
    return Response({
        'id': str(notif.id), 'title': notif.title, 'body': notif.body,
        'target_type': notif.target_type, 'status': notif.status,
        'sent_count': notif.sent_count, 'created_at': notif.created_at.isoformat()
    })
