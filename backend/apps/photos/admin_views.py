from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.utils import timezone
from django.contrib import messages
from apps.accounts.admin_views import admin_required
from apps.notifications.fcm import send_to_all
from apps.notifications.models import Notification
from .models import Photo, PhotoSettings, SelfiePoint, SelfieSubmission


@login_required
@admin_required
def photos_panel(request):
    cfg = PhotoSettings.get()
    tab = request.POST.get('tab', request.GET.get('tab', 'pending'))

    if request.method == 'POST':
        action = request.POST.get('action')
        if action == 'toggle_window':
            cfg.upload_open = not cfg.upload_open
            cfg.updated_by = request.user
            cfg.save()
            messages.success(request, f'Photo upload window {"opened" if cfg.upload_open else "closed"}.')
        elif action == 'toggle_auto':
            cfg.auto_approve = not cfg.auto_approve
            cfg.updated_by = request.user
            cfg.save()
            messages.success(request, f'Auto-approve {"enabled" if cfg.auto_approve else "disabled"}.')
        elif action == 'approve':
            Photo.objects.filter(pk=request.POST.get('pk')).update(
                status=Photo.Status.APPROVED, reviewed_by=request.user, reviewed_at=timezone.now(), rejected_reason='',
            )
        elif action == 'reject':
            Photo.objects.filter(pk=request.POST.get('pk')).update(
                status=Photo.Status.REJECTED, reviewed_by=request.user, reviewed_at=timezone.now(),
                rejected_reason=request.POST.get('reason', '')[:200],
            )
        elif action == 'delete':
            Photo.objects.filter(pk=request.POST.get('pk')).delete()
        elif action == 'approve_all':
            cnt = Photo.objects.filter(status=Photo.Status.PENDING).update(
                status=Photo.Status.APPROVED, reviewed_by=request.user, reviewed_at=timezone.now(),
            )
            messages.success(request, f'{cnt} photos approved.')
        return redirect(f'/panel/photos/?tab={tab}')

    photos = Photo.objects.filter(status=tab).select_related('uploader', 'session').order_by('-created_at')

    return render(request, 'panel/photos.html', {
        'cfg': cfg,
        'photos': photos,
        'tab': tab,
        'pending_count': Photo.objects.filter(status='pending').count(),
        'approved_count': Photo.objects.filter(status='approved').count(),
        'rejected_count': Photo.objects.filter(status='rejected').count(),
    })


@login_required
@admin_required
def selfie_points_panel(request):
    cfg = PhotoSettings.get()

    if request.method == 'POST':
        action = request.POST.get('action')

        # Toggle global challenge window
        if action == 'toggle_window':
            cfg.selfie_upload_open = not cfg.selfie_upload_open
            cfg.updated_by = request.user
            cfg.save()
            
            # Send Push Notification to all participants
            title = "📸 Selfie Spots Challenge"
            if cfg.selfie_upload_open:
                body = "The organizers have opened the Selfie Spots challenge! Walk to the spots around campus, verify your GPS, and claim your points."
            else:
                body = "The Selfie Spots challenge has been closed by the organizers."
                
            try:
                # Create the Notification database entry as expected by fcm.py
                notif = Notification.objects.create(
                    title=title,
                    body=body,
                    delivered_at=timezone.now()
                )
                send_to_all(title, body, {"type": "selfie_spots"}, notif)
            except Exception as e:
                print("FCM broadcast error:", e)

            messages.success(
                request,
                f'Selfie challenge window {"OPENED" if cfg.selfie_upload_open else "CLOSED"} and notification sent.'
            )

        # Create spot zone
        elif action == 'create':
            sp = SelfiePoint.objects.create(
                name=request.POST.get('name', '').strip(),
                description=request.POST.get('description', '').strip(),
                latitude=request.POST.get('latitude'),
                longitude=request.POST.get('longitude'),
                radius_meters=int(request.POST.get('radius_meters') or 20),
                points=int(request.POST.get('points') or 10),
                is_active=request.POST.get('is_active') == 'on',
            )
            if 'sample_photo' in request.FILES:
                sp.sample_photo = request.FILES['sample_photo']
                sp.save()
            messages.success(request, f'Selfie point "{sp.name}" created.')

        # Toggle specific point active status
        elif action == 'toggle':
            pk = request.POST.get('pk')
            sp = get_object_or_404(SelfiePoint, pk=pk)
            sp.is_active = not sp.is_active
            sp.save()
            messages.success(request, f'Selfie point "{sp.name}" {"activated" if sp.is_active else "deactivated"}.')

        # Delete selfie spot
        elif action == 'delete':
            SelfiePoint.objects.filter(pk=request.POST.get('pk')).delete()
            messages.success(request, 'Selfie point deleted.')

        # Delete attendee submission
        elif action == 'delete_submission':
            sub_id = request.POST.get('pk')
            SelfieSubmission.objects.filter(pk=sub_id).delete()
            messages.success(request, 'Attendee selfie submission deleted.')

        return redirect('/panel/selfie-points/')

    points = SelfiePoint.objects.all().order_by('name')
    submissions = SelfieSubmission.objects.select_related('user', 'selfie_point').order_by('-created_at')[:100]

    return render(request, 'panel/selfie_points.html', {
        'cfg': cfg,
        'points': points,
        'submissions': submissions,
        'total_submissions': SelfieSubmission.objects.count(),
        'verified_count': SelfieSubmission.objects.filter(verified_in_geofence=True).count(),
    })
