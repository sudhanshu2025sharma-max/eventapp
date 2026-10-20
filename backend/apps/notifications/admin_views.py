from django.shortcuts import render, redirect, get_object_or_404
import threading
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from .models import DeviceToken, Notification, NotificationAttachment, WebPushSubscription, PushDelivery
from . import fcm
from apps.accounts.permissions_helper import module_required
from django.db.models import Count, Q, Exists, OuterRef


@login_required(login_url='/panel/login/')
@module_required('notifications')
def notifications_page(request):
    notifs = Notification.objects.annotate(
        delivered=Count('user_notifications'),
        seen=Count('user_notifications', filter=Q(user_notifications__read=True)),
        provider_logged=Exists(PushDelivery.objects.filter(notification_id=OuterRef('pk'))),
    ).prefetch_related('attachments').order_by('-created_at')[:20]
    return render(request, 'panel/notifications.html', {
        'device_count': DeviceToken.objects.filter(is_active=True).count() + WebPushSubscription.objects.filter(is_active=True).count(),
        'notifications': notifs,
    })


@login_required(login_url='/panel/login/')
@module_required('notifications')
def send_notification(request):
    if request.method != 'POST':
        return redirect('panel_notifications')

    title       = request.POST.get('title', '').strip()
    body        = request.POST.get('body', '').strip()
    target_type = request.POST.get('target_type', 'all')
    target_role = request.POST.get('target_role', '')

    if not title or not body:
        messages.error(request, 'Title and message required.')
        return redirect('panel_notifications')

    notif = Notification.objects.create(
        title=title, body=body,
        target_type=target_type,
        target_role=target_role,
        sent_by=request.user,
        status='pending',
    )

    # cover image + attachments
    save_fields = []
    if 'cover_image' in request.FILES:
        notif.cover_image = request.FILES['cover_image']
        save_fields.append('cover_image')
    if save_fields:
        notif.save(update_fields=save_fields)
    for f in request.FILES.getlist('attachments'):
        NotificationAttachment.objects.create(notification=notif, file=f, filename=f.name)

    def _push_worker(n_id, t_type, t_role, t_title, t_body):
        import django, os
        os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'confhub.settings')
        django.setup()
        from apps.notifications import fcm as _fcm
        from apps.notifications.models import Notification as _N, DeviceToken as _DT
        try:
            n = _N.objects.get(pk=n_id)
            if t_type == 'all':
                ok, fail, bad = _fcm.send_to_all(t_title, t_body, {}, n)
            elif t_type == 'role':
                ok, fail, bad = _fcm.send_to_role(t_role, t_title, t_body, {}, n)
            else:
                n.status = 'failed'; n.save(update_fields=['status']); return
            if bad:
                _DT.objects.filter(token__in=bad).update(is_active=False)
            n.status = 'sent' if ok > 0 else 'failed'
            n.sent_count = ok; n.failed_count = fail
            n.save(update_fields=['status', 'sent_count', 'failed_count'])
        except Exception as exc:
            try:
                n = _N.objects.get(pk=n_id)
                n.status = 'failed'; n.save(update_fields=['status'])
            except Exception:
                pass

    threading.Thread(
        target=_push_worker,
        args=(notif.id, target_type, target_role, title, body),
        daemon=True,
    ).start()

    messages.success(request, 'Notification queued for delivery. Refresh this page in a few seconds to see results.')
    return redirect('panel_notifications')


from .models import NotificationAttachment


@login_required(login_url='/panel/login/')
@module_required('notifications')
def notification_detail(request, pk):
    notif = get_object_or_404(Notification, pk=pk)
    return render(request, 'panel/notification_detail.html', {
        'notif': notif,
        'attachments': notif.attachments.all(),
    })


@login_required(login_url='/panel/login/')
@module_required('notifications')
def notification_edit(request, pk):
    notif = get_object_or_404(Notification, pk=pk)
    if request.method == 'POST':
        notif.title = request.POST.get('title', notif.title).strip()
        notif.body  = request.POST.get('body',  notif.body).strip()
        if 'cover_image' in request.FILES:
            notif.cover_image = request.FILES['cover_image']
        notif.save()

        # handle new attachments
        for f in request.FILES.getlist('attachments'):
            NotificationAttachment.objects.create(
                notification=notif,
                file=f,
                filename=f.name,
            )

        # handle attachment deletions
        for aid in request.POST.getlist('delete_attachment'):
            NotificationAttachment.objects.filter(pk=aid, notification=notif).delete()

        messages.success(request, 'Notification updated.')
        return redirect('panel_notifications')

    return render(request, 'panel/notification_edit.html', {
        'notif': notif,
        'attachments': notif.attachments.all(),
    })


@login_required(login_url='/panel/login/')
@module_required('notifications')
def notification_delete(request, pk):
    notif = get_object_or_404(Notification, pk=pk)
    if request.method == 'POST':
        notif.delete()
        messages.success(request, 'Notification deleted.')
    return redirect('panel_notifications')
