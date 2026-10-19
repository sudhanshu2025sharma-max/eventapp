from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from .models import DeviceToken, Notification, NotificationAttachment
from . import fcm
from apps.accounts.permissions_helper import module_required


@login_required(login_url='/panel/login/')
@module_required('notifications')
def notifications_page(request):
    notifs = Notification.objects.all()[:20]
    for n in notifs:
        n.delivered = n.delivered_count
        n.seen      = n.read_count
    return render(request, 'panel/notifications.html', {
        'device_count': DeviceToken.objects.filter(is_active=True).count(),
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

    try:
        if target_type == 'all':
            success, failed, bad = fcm.send_to_all(title, body, {}, notif)
        elif target_type == 'role':
            success, failed, bad = fcm.send_to_role(target_role, title, body, {}, notif)
        else:
            raise ValueError('Invalid target type')

        if bad:
            from .models import DeviceToken
            DeviceToken.objects.filter(token__in=bad).update(is_active=False)

        notif.status      = 'sent'
        notif.sent_count  = success
        notif.failed_count = failed
        notif.save()
        messages.success(request, f'Sent to {success} device(s). {failed} failed.')

    except Exception as e:
        notif.status = 'failed'
        notif.save()
        messages.error(request, f'Failed: {e}')

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
