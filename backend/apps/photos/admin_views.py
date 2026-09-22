from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.utils import timezone
from django.contrib import messages
from apps.accounts.admin_views import admin_required
from apps.notifications.fcm import send_to_all
from apps.notifications.models import Notification
from apps.sponsors.models import Sponsor
from apps.leaderboard.utils import award_points
from apps.leaderboard.models import PointAction
from .models import Photo, PhotoSettings, SelfiePoint, SelfiePointImage, SelfieSubmission


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
            pk = request.POST.get('pk')
            photo = Photo.objects.filter(pk=pk).first()
            if photo:
                photo.status = Photo.Status.APPROVED
                photo.reviewed_by = request.user
                photo.reviewed_at = timezone.now()
                photo.rejected_reason = ''
                photo.save()
                if photo.caption and photo.caption.startswith("📸 Selfie Spot:"):
                    spot_name = photo.caption.split("📸 Selfie Spot:")[1].strip()
                    sub = SelfieSubmission.objects.filter(user=photo.uploader, selfie_point__name=spot_name, status='pending').first()
                    if sub:
                        sub.status = 'approved'
                        pts = sub.selfie_point.points or 10
                        sub.points_awarded = pts
                        sub.reviewed_by = request.user
                        sub.reviewed_at = timezone.now()
                        sub.save()
                        award_points(sub.user, PointAction.PHOTO_UPLOAD, note=f'Checkpoint: {sub.selfie_point.name}', points_override=pts)
                else:
                    award_points(photo.uploader, PointAction.PHOTO_UPLOAD, 'Photo approved')
        elif action == 'reject':
            pk = request.POST.get('pk')
            reason = request.POST.get('reason', '')[:200]
            photo = Photo.objects.filter(pk=pk).first()
            if photo:
                photo.status = Photo.Status.REJECTED
                photo.reviewed_by = request.user
                photo.reviewed_at = timezone.now()
                photo.rejected_reason = reason
                photo.save()
                if photo.caption and photo.caption.startswith("📸 Selfie Spot:"):
                    spot_name = photo.caption.split("📸 Selfie Spot:")[1].strip()
                    sub = SelfieSubmission.objects.filter(user=photo.uploader, selfie_point__name=spot_name).first()
                    if sub:
                        if sub.status == 'approved' and sub.points_awarded > 0:
                            award_points(sub.user, PointAction.PHOTO_UPLOAD, note=f'Revoked: {sub.selfie_point.name}', points_override=-sub.points_awarded)
                        sub.status = 'rejected'
                        sub.rejected_reason = reason
                        sub.points_awarded = 0
                        sub.reviewed_by = request.user
                        sub.reviewed_at = timezone.now()
                        sub.save()
        elif action == 'delete':
            Photo.objects.filter(pk=request.POST.get('pk')).delete()
        elif action == 'approve_all':
            cnt = 0
            for photo in Photo.objects.filter(status=Photo.Status.PENDING):
                photo.status = Photo.Status.APPROVED
                photo.reviewed_by = request.user
                photo.reviewed_at = timezone.now()
                photo.save()
                if photo.caption and photo.caption.startswith("📸 Selfie Spot:"):
                    spot_name = photo.caption.split("📸 Selfie Spot:")[1].strip()
                    sub = SelfieSubmission.objects.filter(user=photo.uploader, selfie_point__name=spot_name, status='pending').first()
                    if sub:
                        sub.status = 'approved'
                        pts = sub.selfie_point.points or 10
                        sub.points_awarded = pts
                        sub.save()
                        award_points(sub.user, PointAction.PHOTO_UPLOAD, note=f'Checkpoint: {sub.selfie_point.name}', points_override=pts)
                else:
                    award_points(photo.uploader, PointAction.PHOTO_UPLOAD, 'Photo approved')
                cnt += 1
            messages.success(request, f'{cnt} photos approved.')
        return redirect(f'/panel/photos/?tab={tab}')
    photos = Photo.objects.filter(status=tab).select_related('uploader', 'session').order_by('-created_at')
    return render(request, 'panel/photos.html', {
        'cfg': cfg, 'photos': photos, 'tab': tab,
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
        if action == 'toggle_window':
            cfg.selfie_upload_open = not cfg.selfie_upload_open
            cfg.updated_by = request.user
            cfg.save()
            title = "📸 Checkpoint Challenges"
            body = "Organizers have OPENED Checkpoint Challenges!" if cfg.selfie_upload_open else "Checkpoint Challenges are currently closed."
            try:
                notif = Notification.objects.create(title=title, body=body, target_type='all', status='sent', sent_by=request.user, data={"type": "selfie_spots"})
                send_to_all(title, body, {"type": "selfie_spots"}, notif)
            except Exception as e:
                print("FCM broadcast error:", e)
            messages.success(request, f'Checkpoint window {"OPENED" if cfg.selfie_upload_open else "CLOSED"}.')

        elif action == 'create':
            cp_type = request.POST.get('checkpoint_type', 'selfie')
            name = request.POST.get('name', '').strip()
            desc = request.POST.get('description', '').strip()
            pts = int(request.POST.get('points') or 10)
            is_act = request.POST.get('is_active') == 'on'
            if cp_type == 'selfie':
                sp = SelfiePoint.objects.create(
                    name=name, description=desc, checkpoint_type='selfie',
                    latitude=request.POST.get('latitude') or None,
                    longitude=request.POST.get('longitude') or None,
                    radius_meters=int(request.POST.get('radius_meters') or 20),
                    points=pts, is_active=is_act,
                )
            else:
                sp = SelfiePoint.objects.create(
                    name=name, description=desc, checkpoint_type='sponsor_zone',
                    point_a_lat=request.POST.get('point_a_lat') or None,
                    point_a_lng=request.POST.get('point_a_lng') or None,
                    point_b_lat=request.POST.get('point_b_lat') or None,
                    point_b_lng=request.POST.get('point_b_lng') or None,
                    corridor_width_meters=int(request.POST.get('corridor_width_meters') or 30),
                    points=pts, is_active=is_act,
                )
                sponsor_ids = request.POST.getlist('sponsors')
                if sponsor_ids:
                    sp.sponsors.set(sponsor_ids)

            # Multi-image upload
            sample_photos = request.FILES.getlist('sample_photos')
            if not sample_photos and 'sample_photo' in request.FILES:
                sample_photos = [request.FILES['sample_photo']]
            if sample_photos:
                sp.sample_photo = sample_photos[0]
                sp.save()
                for i, img in enumerate(sample_photos):
                    SelfiePointImage.objects.create(selfie_point=sp, image=img, order=i)

            messages.success(request, f'Checkpoint "{sp.name}" created.')

        elif action == 'toggle':
            sp = get_object_or_404(SelfiePoint, pk=request.POST.get('pk'))
            sp.is_active = not sp.is_active
            sp.save()
            messages.success(request, f'Checkpoint "{sp.name}" {"activated" if sp.is_active else "deactivated"}.')
        elif action == 'delete':
            SelfiePoint.objects.filter(pk=request.POST.get('pk')).delete()
            messages.success(request, 'Checkpoint deleted.')
        elif action == 'approve_submission':
            sub = get_object_or_404(SelfieSubmission, pk=request.POST.get('pk'))
            if sub.status != 'approved':
                sub.status = 'approved'
                pts = sub.selfie_point.points or 10
                sub.points_awarded = pts
                sub.reviewed_by = request.user
                sub.reviewed_at = timezone.now()
                sub.save()
                award_points(sub.user, PointAction.PHOTO_UPLOAD, note=f'Checkpoint: {sub.selfie_point.name}', points_override=pts)
                Photo.objects.filter(uploader=sub.user, caption__icontains=sub.selfie_point.name).update(
                    status=Photo.Status.APPROVED, reviewed_by=request.user, reviewed_at=timezone.now()
                )
                messages.success(request, f'Approved (+{pts} pts).')
        elif action == 'reject_submission':
            reason = request.POST.get('reason', 'Verification declined')[:200]
            sub = get_object_or_404(SelfieSubmission, pk=request.POST.get('pk'))
            if sub.status == 'approved' and sub.points_awarded > 0:
                award_points(sub.user, PointAction.PHOTO_UPLOAD, note=f'Revoked: {sub.selfie_point.name}', points_override=-sub.points_awarded)
            sub.status = 'rejected'
            sub.rejected_reason = reason
            sub.points_awarded = 0
            sub.reviewed_by = request.user
            sub.reviewed_at = timezone.now()
            sub.save()
            Photo.objects.filter(uploader=sub.user, caption__icontains=sub.selfie_point.name).update(status=Photo.Status.REJECTED, rejected_reason=reason)
            messages.success(request, f'Rejected check-in.')
        elif action == 'delete_submission':
            sub = SelfieSubmission.objects.filter(pk=request.POST.get('pk')).first()
            if sub:
                if sub.status == 'approved' and sub.points_awarded > 0:
                    award_points(sub.user, PointAction.PHOTO_UPLOAD, note=f'Revoked: {sub.selfie_point.name}', points_override=-sub.points_awarded)
                sub.delete()
            messages.success(request, 'Submission deleted.')
        return redirect('/panel/checkpoint/')

    points = SelfiePoint.objects.prefetch_related('sponsors', 'images').all().order_by('-created_at')
    submissions = SelfieSubmission.objects.select_related('user', 'selfie_point').order_by('-created_at')[:100]
    all_sponsors = Sponsor.objects.all().order_by('name')
    return render(request, 'panel/selfie_points.html', {
        'cfg': cfg, 'points': points, 'submissions': submissions,
        'all_sponsors': all_sponsors,
        'total_submissions': SelfieSubmission.objects.count(),
        'verified_count': SelfieSubmission.objects.filter(verified_in_geofence=True).count(),
        'approved_count': SelfieSubmission.objects.filter(status='approved').count(),
    })
