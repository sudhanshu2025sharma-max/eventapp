import csv
import json
from django.shortcuts import render, get_object_or_404, redirect
from django.contrib import messages
from django.db.models import Q, Count, F
from django.http import HttpResponse, HttpResponseForbidden
from django.utils import timezone
from datetime import timedelta
from functools import wraps

from .models import (
    Conversation, Message, ConnectionRequest,
    MessageReport, MessageReaction, BlockedUser,
)


def admin_required(view_func):
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            from django.conf import settings
            return redirect(settings.LOGIN_URL)
        if not hasattr(request.user, 'role') or request.user.role not in ('super_admin', 'mgmt_admin'):
            return HttpResponseForbidden('Admin access required.')
        return view_func(request, *args, **kwargs)
    return wrapper


@admin_required
def chat_panel(request):
    search = request.GET.get('search', '').strip()

    convs = Conversation.objects.select_related(
        'participant_a', 'participant_b'
    ).annotate(
        message_count=Count('messages')
    ).order_by('-last_message_at', '-created_at')

    if search:
        convs = convs.filter(
            Q(participant_a__first_name__icontains=search) |
            Q(participant_a__last_name__icontains=search) |
            Q(participant_a__email__icontains=search) |
            Q(participant_b__first_name__icontains=search) |
            Q(participant_b__last_name__icontains=search) |
            Q(participant_b__email__icontains=search)
        )

    total_convs = Conversation.objects.count()
    total_messages = Message.objects.count()
    total_requests = ConnectionRequest.objects.count()
    pending_reqs = ConnectionRequest.objects.filter(status='pending').count()
    flagged_count = MessageReport.objects.filter(reviewed=False).count()
    blocked_count = BlockedUser.objects.count()

    return render(request, 'panel/chat/list.html', {
        'conversations': convs,
        'search': search,
        'total_convs': total_convs,
        'total_messages': total_messages,
        'total_requests': total_requests,
        'pending_reqs': pending_reqs,
        'flagged_count': flagged_count,
        'blocked_count': blocked_count,
    })


@admin_required
def chat_thread(request, conversation_id):
    conv = get_object_or_404(Conversation, id=conversation_id)
    msgs = conv.messages.select_related('sender', 'reply_to', 'reply_to__sender').prefetch_related('reactions', 'reports').order_by('created_at')

    if request.method == 'POST':
        action = request.POST.get('action')
        if action == 'delete_conversation':
            conv.delete()
            messages.success(request, 'Conversation deleted.')
            return redirect('chat_panel')
        elif action == 'delete_message':
            msg_id = request.POST.get('message_id')
            try:
                msg = Message.objects.get(id=msg_id, conversation=conv)
                msg.is_deleted = True
                msg.content = ''
                msg.save(update_fields=['is_deleted', 'content'])
                messages.success(request, 'Message deleted.')
            except Message.DoesNotExist:
                messages.error(request, 'Message not found.')
            return redirect('chat_thread', conversation_id=conversation_id)

    return render(request, 'panel/chat/thread.html', {
        'conv': conv,
        'msgs': msgs,
    })


@admin_required
def chat_requests_panel(request):
    search = request.GET.get('search', '').strip()
    status_filter = request.GET.get('status', '').strip()

    reqs = ConnectionRequest.objects.select_related(
        'sender', 'receiver'
    ).order_by('-created_at')

    if search:
        reqs = reqs.filter(
            Q(sender__first_name__icontains=search) |
            Q(sender__last_name__icontains=search) |
            Q(sender__email__icontains=search) |
            Q(receiver__first_name__icontains=search) |
            Q(receiver__last_name__icontains=search) |
            Q(receiver__email__icontains=search)
        )
    if status_filter:
        reqs = reqs.filter(status=status_filter)

    return render(request, 'panel/chat/requests.html', {
        'requests': reqs,
        'search': search,
        'status_filter': status_filter,
    })


@admin_required
def chat_reports_panel(request):
    status_filter = request.GET.get('status', '').strip()  # 'pending' or 'reviewed'

    reports = MessageReport.objects.select_related(
        'message', 'message__sender', 'message__conversation',
        'message__conversation__participant_a', 'message__conversation__participant_b',
        'reporter', 'reviewed_by',
    ).order_by('-created_at')

    if status_filter == 'pending':
        reports = reports.filter(reviewed=False)
    elif status_filter == 'reviewed':
        reports = reports.filter(reviewed=True)

    pending_count = MessageReport.objects.filter(reviewed=False).count()
    total_count = MessageReport.objects.count()

    return render(request, 'panel/chat/reports.html', {
        'reports': reports,
        'status_filter': status_filter,
        'pending_count': pending_count,
        'total_count': total_count,
    })


@admin_required
def chat_report_action(request, report_id):
    if request.method != 'POST':
        return redirect('chat_reports_panel')

    report = get_object_or_404(MessageReport, id=report_id)
    action = request.POST.get('action', '')

    if action == 'dismiss':
        report.reviewed = True
        report.reviewed_by = request.user
        report.reviewed_at = timezone.now()
        report.save(update_fields=['reviewed', 'reviewed_by', 'reviewed_at'])
        messages.success(request, 'Report dismissed.')

    elif action == 'delete_message':
        msg = report.message
        msg.is_deleted = True
        msg.content = ''
        msg.save(update_fields=['is_deleted', 'content'])
        report.reviewed = True
        report.reviewed_by = request.user
        report.reviewed_at = timezone.now()
        report.save(update_fields=['reviewed', 'reviewed_by', 'reviewed_at'])
        messages.success(request, 'Message deleted and report resolved.')

    elif action == 'warn_user':
        sender = report.message.sender
        note = f'Your message was reported for: {report.get_reason_display()}. Please follow conference guidelines.'
        sender.warning_note = note
        sender.save(update_fields=['warning_note'])
        report.reviewed = True
        report.reviewed_by = request.user
        report.reviewed_at = timezone.now()
        report.save(update_fields=['reviewed', 'reviewed_by', 'reviewed_at'])
        # Send push
        try:
            from apps.notifications.models import Notification
            from apps.notifications import fcm
            notif = Notification.objects.create(
                title='⚠️ Warning from Admin',
                body=note,
                target_type='user',
                target_user=sender,
                sent_by=request.user,
                status='pending',
                data={'type': 'admin_warning'},
            )
            fcm.send_to_user(sender, notif.title, notif.body, notif.data, notif)
            notif.status = 'sent'
            notif.save(update_fields=['status'])
        except Exception:
            pass
        messages.success(request, f'Warning sent to {sender.get_full_name()} and report resolved.')

    elif action == 'block_user':
        sender = report.message.sender
        BlockedUser.objects.get_or_create(blocker=report.reporter, blocked=sender)
        report.reviewed = True
        report.reviewed_by = request.user
        report.reviewed_at = timezone.now()
        report.save(update_fields=['reviewed', 'reviewed_by', 'reviewed_at'])
        messages.success(request, f'{sender.get_full_name()} blocked for reporter and report resolved.')

    return redirect('chat_reports_panel')


@admin_required
def chat_analytics(request):
    now = timezone.now()
    today = now.date()
    week_ago = today - timedelta(days=7)

    # Daily message counts for last 7 days
    daily_data = []
    for i in range(7):
        day = today - timedelta(days=6 - i)
        count = Message.objects.filter(created_at__date=day).count()
        daily_data.append({
            'date': day.strftime('%b %d'),
            'count': count,
        })

    # Most active users
    from django.contrib.auth import get_user_model
    User = get_user_model()
    active_users = User.objects.filter(
        chat_messages__created_at__date__gte=week_ago
    ).annotate(
        msg_count=Count('chat_messages')
    ).order_by('-msg_count')[:10]

    # Stats
    total_messages = Message.objects.count()
    total_convos = Conversation.objects.count()
    total_connections = ConnectionRequest.objects.filter(status='accepted').count()
    today_messages = Message.objects.filter(created_at__date=today).count()
    total_reactions = MessageReaction.objects.count()
    total_images = Message.objects.filter(message_type='image').count()

    max_daily = max((d['count'] for d in daily_data), default=1) or 1

    return render(request, 'panel/chat/analytics.html', {
        'daily_data': daily_data,
        'daily_json': json.dumps(daily_data),
        'max_daily': max_daily,
        'active_users': active_users,
        'total_messages': total_messages,
        'total_convos': total_convos,
        'total_connections': total_connections,
        'today_messages': today_messages,
        'total_reactions': total_reactions,
        'total_images': total_images,
    })


@admin_required
def chat_export(request):
    fmt = request.GET.get('format', 'csv')

    convs = Conversation.objects.select_related(
        'participant_a', 'participant_b'
    ).prefetch_related('messages__sender').order_by('created_at')

    if fmt == 'json':
        data = []
        for conv in convs:
            conv_data = {
                'id': str(conv.id),
                'participant_a': conv.participant_a.get_full_name(),
                'participant_a_email': conv.participant_a.email,
                'participant_b': conv.participant_b.get_full_name(),
                'participant_b_email': conv.participant_b.email,
                'topic': conv.topic_display,
                'created_at': conv.created_at.isoformat(),
                'messages': [],
            }
            for msg in conv.messages.order_by('created_at'):
                conv_data['messages'].append({
                    'sender': msg.sender.get_full_name(),
                    'sender_email': msg.sender.email,
                    'content': msg.content if not msg.is_deleted else '[deleted]',
                    'type': msg.message_type,
                    'created_at': msg.created_at.isoformat(),
                })
            data.append(conv_data)

        response = HttpResponse(
            json.dumps(data, indent=2),
            content_type='application/json'
        )
        response['Content-Disposition'] = f'attachment; filename="chat_export_{today}.json"'
        return response

    # CSV export
    response = HttpResponse(content_type='text/csv')
    today = timezone.now().date()
    response['Content-Disposition'] = f'attachment; filename="chat_export_{today}.csv"'

    writer = csv.writer(response)
    writer.writerow([
        'Conversation ID', 'Participant A', 'Participant A Email',
        'Participant B', 'Participant B Email', 'Topic',
        'Message Sender', 'Message Sender Email', 'Content',
        'Type', 'Created At'
    ])

    for conv in convs:
        for msg in conv.messages.order_by('created_at'):
            writer.writerow([
                str(conv.id),
                conv.participant_a.get_full_name(),
                conv.participant_a.email,
                conv.participant_b.get_full_name(),
                conv.participant_b.email,
                conv.topic_display,
                msg.sender.get_full_name(),
                msg.sender.email,
                msg.content if not msg.is_deleted else '[deleted]',
                msg.message_type,
                msg.created_at.isoformat(),
            ])

    return response


@admin_required
def chat_shakes_panel(request):
    from django.db.models import Q
    from django.shortcuts import render
    from .models import ShakeLog

    search = (request.GET.get('search') or '').strip()
    event_type = (request.GET.get('event') or '').strip()
    date_str = (request.GET.get('date') or '').strip()

    qs = ShakeLog.objects.select_related('user', 'partner').order_by('-created_at')

    if event_type in ('shake', 'connect'):
        qs = qs.filter(event_type=event_type)

    if date_str:
        qs = qs.filter(created_at__date=date_str)

    if search:
        qs = qs.filter(
            Q(user__first_name__icontains=search) |
            Q(user__last_name__icontains=search) |
            Q(user__email__icontains=search) |
            Q(user__registration_id__icontains=search) |
            Q(partner__first_name__icontains=search) |
            Q(partner__last_name__icontains=search) |
            Q(partner__email__icontains=search) |
            Q(partner__registration_id__icontains=search)
        )

    logs = qs[:500]

    total_count = qs.count()
    shake_count = qs.filter(event_type='shake').count()
    connect_count = qs.filter(event_type='connect').count()

    rows = []
    for log in logs:
        rows.append({
            'id': str(log.id),
            'event_type': log.event_type,
            'user_name': log.user.get_full_name() or log.user.email.split('@')[0],
            'user_email': log.user.email,
            'user_registration_id': log.user.registration_id or '',
            'partner_name': (log.partner.get_full_name() or log.partner.email.split('@')[0]) if log.partner else '',
            'partner_email': log.partner.email if log.partner else '',
            'partner_registration_id': log.partner.registration_id or '' if log.partner else '',
            'created_at': log.created_at,
        })

    return render(request, 'panel/chat/shakes.html', {
        'rows': rows,
        'search': search,
        'event_type': event_type,
        'date_str': date_str,
        'total_count': total_count,
        'shake_count': shake_count,
        'connect_count': connect_count,
    })
