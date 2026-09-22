from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Count, Q
from django.db import IntegrityError
import math

from apps.checkins.models import CheckIn
from apps.leaderboard.utils import award_points
from apps.leaderboard.models import PointAction
from .models import Photo, PhotoSettings, ScheduleSession, SelfiePoint, SelfiePointImage, SelfieSubmission


def _is_checked_in(user):
    return CheckIn.objects.filter(user=user, checkin_type='conference').exists()


def _photo_data(photo, request):
    return {
        'id': photo.id,
        'image_url': request.build_absolute_uri(photo.image.url) if photo.image else None,
        'caption': photo.caption,
        'session_id': str(photo.session_id) if photo.session_id else None,
        'session_title': photo.session.title if photo.session_id else None,
        'uploader': photo.uploader.get_full_name() or photo.uploader.email.split('@')[0],
        'created_at': photo.created_at.isoformat(),
    }


def _is_in_corridor(lat_p, lng_p, lat_a, lng_a, lat_b, lng_b, width_meters):
    if lat_a is None or lng_a is None or lat_b is None or lng_b is None:
        return False
    lat_avg = math.radians((float(lat_a) + float(lat_b)) / 2.0)
    by = (float(lat_b) - float(lat_a)) * 111000.0
    bx = (float(lng_b) - float(lng_a)) * 111000.0 * math.cos(lat_avg)
    py = (float(lat_p) - float(lat_a)) * 111000.0
    px = (float(lng_p) - float(lng_a)) * 111000.0 * math.cos(lat_avg)
    seg_len_sq = bx * bx + by * by
    if seg_len_sq == 0:
        return math.sqrt(px * px + py * py) <= (width_meters / 2.0)
    t = max(0.0, min(1.0, (px * bx + py * by) / seg_len_sq))
    cx, cy = t * bx, t * by
    return math.sqrt((px - cx) ** 2 + (py - cy) ** 2) <= (width_meters / 2.0)


def _selfie_point_data(sp, request, completed=False, submission=None):
    sample = None
    if sp.sample_photo:
        try:
            sample = request.build_absolute_uri(sp.sample_photo.url)
        except Exception:
            sample = sp.sample_photo.url

    # Multi-image support — returns array of URLs
    sample_urls = []
    for img in sp.images.all():
        try:
            sample_urls.append(request.build_absolute_uri(img.image.url))
        except Exception:
            pass
    if not sample_urls and sample:
        sample_urls = [sample]

    sponsors_list = []
    if sp.checkpoint_type == 'sponsor_zone':
        for s in sp.sponsors.all():
            sponsors_list.append({
                'id': s.id,
                'name': s.name,
                'logo_url': request.build_absolute_uri(s.logo.url) if s.logo else None,
                'tier': s.tier,
                'stall_number': getattr(s, 'stall_number', None)
            })

    return {
        'id': sp.id,
        'name': sp.name,
        'description': sp.description,
        'checkpoint_type': sp.checkpoint_type,
        'latitude': float(sp.latitude) if sp.latitude else None,
        'longitude': float(sp.longitude) if sp.longitude else None,
        'radius_meters': sp.radius_meters,
        'point_a_lat': float(sp.point_a_lat) if sp.point_a_lat else None,
        'point_a_lng': float(sp.point_a_lng) if sp.point_a_lng else None,
        'point_b_lat': float(sp.point_b_lat) if sp.point_b_lat else None,
        'point_b_lng': float(sp.point_b_lng) if sp.point_b_lng else None,
        'corridor_width_meters': sp.corridor_width_meters,
        'points': sp.points,
        'sample_photo_url': sample,
        'sample_photo_urls': sample_urls,
        'is_active': sp.is_active,
        'completed': completed,
        'sponsors': sponsors_list,
        'submission': (
            {
                'id': submission.id,
                'photo_url': request.build_absolute_uri(submission.photo.url) if submission.photo else None,
                'distance_meters': submission.distance_meters,
                'verified_in_geofence': submission.verified_in_geofence,
                'status': submission.status,
                'points_awarded': submission.points_awarded,
                'rejected_reason': submission.rejected_reason,
                'created_at': submission.created_at.isoformat(),
            }
            if submission else None
        ),
    }


# ── Public / Gallery ────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([AllowAny])
def gallery(request):
    # Public approved gallery — upload/check-in gates stay on write endpoints
    qs = Photo.objects.filter(status=Photo.Status.APPROVED).select_related('uploader', 'session')
    session_id = request.query_params.get('session')
    if session_id:
        qs = qs.filter(session_id=session_id)
    elif request.query_params.get('wall'):
        qs = qs.filter(session__isnull=True)
    return Response({
        'upload_open': PhotoSettings.get().upload_open,
        'selfie_upload_open': PhotoSettings.get().selfie_upload_open,
        'photos': [_photo_data(p, request) for p in qs[:200]],
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def upload(request):
    if not _is_checked_in(request.user):
        return Response({'error': 'Conference check-in required'}, status=403)
    settings = PhotoSettings.get()
    if not settings.upload_open:
        return Response({'error': 'Photo uploads are currently closed'}, status=403)
    image = request.FILES.get('image')
    if not image:
        return Response({'error': 'No image file received.'}, status=400)
    content_type = getattr(image, 'content_type', '') or ''
    if content_type and not content_type.startswith('image/'):
        return Response({'error': 'Only image files are allowed.'}, status=400)
    if image.size > 10 * 1024 * 1024:
        return Response({'error': 'Image must be under 10 MB.'}, status=400)
    session = None
    session_id = request.data.get('session_id')
    if session_id:
        try:
            session = ScheduleSession.objects.get(pk=session_id, is_published=True)
        except ScheduleSession.DoesNotExist:
            return Response({'error': 'Session not found'}, status=404)
    status = Photo.Status.APPROVED if settings.auto_approve else Photo.Status.PENDING
    photo = Photo.objects.create(
        uploader=request.user, image=image,
        caption=request.data.get('caption', '').strip()[:300],
        session=session, status=status,
    )
    return Response({
        'id': photo.id, 'status': photo.status,
        'auto_approved': settings.auto_approve,
        'message': 'Photo uploaded and approved!' if settings.auto_approve else 'Photo uploaded and pending admin approval.',
    }, status=201)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_photos(request):
    qs = Photo.objects.filter(uploader=request.user).select_related('session')
    return Response({
        'photos': [{**_photo_data(p, request), 'status': p.status, 'rejected_reason': p.rejected_reason} for p in qs]
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def sessions_with_photos(request):
    if not _is_checked_in(request.user):
        return Response({'error': 'Conference check-in required'}, status=403)
    sessions = ScheduleSession.objects.filter(
        photos__status=Photo.Status.APPROVED, is_published=True,
    ).annotate(photo_count=Count('photos')).order_by('day', 'start_datetime')
    return Response({
        'sessions': [{'id': str(s.id), 'title': s.title, 'day': s.day, 'session_type': s.session_type, 'photo_count': s.photo_count} for s in sessions]
    })


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_my_photo(request, pk):
    try:
        photo = Photo.objects.get(pk=pk, uploader=request.user)
    except Photo.DoesNotExist:
        return Response({'error': 'Photo not found or not yours'}, status=404)
    photo.delete()
    return Response({'success': True})


# ── Admin API ──────────────────────────────────────────────────────

def _is_admin(user):
    return user.role in ('super_admin', 'mgmt_admin', 'team_head', 'staff')


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def admin_settings(request):
    if not _is_admin(request.user):
        return Response({'error': 'Forbidden'}, status=403)
    cfg = PhotoSettings.get()
    if request.method == 'POST':
        if 'upload_open' in request.data:
            cfg.upload_open = bool(request.data['upload_open'])
        if 'selfie_upload_open' in request.data:
            cfg.selfie_upload_open = bool(request.data['selfie_upload_open'])
        if 'auto_approve' in request.data:
            cfg.auto_approve = bool(request.data['auto_approve'])
        cfg.updated_by = request.user
        cfg.save()
    return Response({
        'upload_open': cfg.upload_open, 'selfie_upload_open': cfg.selfie_upload_open,
        'auto_approve': cfg.auto_approve, 'updated_at': cfg.updated_at.isoformat(),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_queue(request):
    if not _is_admin(request.user):
        return Response({'error': 'Forbidden'}, status=403)
    status_filter = request.query_params.get('status', 'pending')
    qs = Photo.objects.filter(status=status_filter).select_related('uploader', 'session')
    session_filter = request.query_params.get('session')
    if session_filter == 'wall':
        qs = qs.filter(session__isnull=True)
    elif session_filter:
        qs = qs.filter(session_id=session_filter)
    return Response({
        'photos': [{
            'id': p.id, 'image_url': request.build_absolute_uri(p.image.url) if p.image else None,
            'caption': p.caption, 'uploader': p.uploader.get_full_name() or p.uploader.email,
            'uploader_email': p.uploader.email, 'session_title': p.session.title if p.session else None,
            'status': p.status, 'rejected_reason': p.rejected_reason, 'created_at': p.created_at.isoformat(),
        } for p in qs]
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_review(request, pk):
    if not _is_admin(request.user):
        return Response({'error': 'Forbidden'}, status=403)
    try:
        photo = Photo.objects.get(pk=pk)
    except Photo.DoesNotExist:
        return Response({'error': 'Not found'}, status=404)
    action = request.data.get('action')
    if action == 'approve':
        photo.status = Photo.Status.APPROVED
        photo.rejected_reason = ''
    elif action == 'reject':
        photo.status = Photo.Status.REJECTED
        photo.rejected_reason = request.data.get('reason', '')[:200]
    else:
        return Response({'error': 'action must be approve or reject'}, status=400)
    photo.reviewed_by = request.user
    photo.reviewed_at = timezone.now()
    photo.save()
    if photo.caption and photo.caption.startswith("📸 Selfie Spot:"):
        spot_name = photo.caption.split("📸 Selfie Spot:")[1].strip()
        try:
            sub = SelfieSubmission.objects.get(user=photo.uploader, selfie_point__name=spot_name, status='pending')
            sub.reviewed_by = request.user
            sub.reviewed_at = timezone.now()
            if action == 'approve':
                sub.status = 'approved'
                pts = sub.selfie_point.points or 10
                sub.points_awarded = pts
                sub.save()
                award_points(sub.user, PointAction.PHOTO_UPLOAD, note=f'Checkpoint: {sub.selfie_point.name}', points_override=pts)
            else:
                sub.status = 'rejected'
                sub.rejected_reason = photo.rejected_reason
                sub.save()
        except SelfieSubmission.DoesNotExist:
            pass
    return Response({'id': photo.id, 'status': photo.status})


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def admin_delete(request, pk):
    if not _is_admin(request.user):
        return Response({'error': 'Forbidden'}, status=403)
    try:
        photo = Photo.objects.get(pk=pk)
        if photo.caption and photo.caption.startswith("📸 Selfie Spot:"):
            spot_name = photo.caption.split("📸 Selfie Spot:")[1].strip()
            try:
                sub = SelfieSubmission.objects.get(user=photo.uploader, selfie_point__name=spot_name)
                if sub.status == 'approved' and sub.points_awarded > 0:
                    award_points(sub.user, PointAction.PHOTO_UPLOAD, note=f'Revoked: {sub.selfie_point.name}', points_override=-sub.points_awarded)
                sub.delete()
            except SelfieSubmission.DoesNotExist:
                pass
        photo.delete()
    except Photo.DoesNotExist:
        return Response({'error': 'Not found'}, status=404)
    return Response({'success': True})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_stats(request):
    if not _is_admin(request.user):
        return Response({'error': 'Forbidden'}, status=403)
    total = Photo.objects.count()
    pending = Photo.objects.filter(status='pending').count()
    approved = Photo.objects.filter(status='approved').count()
    rejected = Photo.objects.filter(status='rejected').count()
    wall_count = Photo.objects.filter(session__isnull=True).count()
    sessions = ScheduleSession.objects.filter(
        photos__isnull=False, is_published=True,
    ).annotate(
        total_photos=Count('photos'),
        pending_photos=Count('photos', filter=Q(photos__status='pending')),
        approved_photos=Count('photos', filter=Q(photos__status='approved')),
    ).order_by('day', 'start_datetime').distinct()
    return Response({
        'total': total, 'pending': pending, 'approved': approved,
        'rejected': rejected, 'wall_count': wall_count,
        'sessions': [{'id': str(s.id), 'title': s.title, 'day': s.day, 'session_type': s.session_type,
                       'total_photos': s.total_photos, 'pending_photos': s.pending_photos, 'approved_photos': s.approved_photos} for s in sessions],
    })


# ── Selfie Spots / Checkpoints ─────────────────────────────────────

def _haversine_m(lat1, lon1, lat2, lon2):
    R = 6371000.0
    p1, p2 = math.radians(float(lat1)), math.radians(float(lat2))
    dp = math.radians(float(lat2) - float(lat1))
    dl = math.radians(float(lon2) - float(lon1))
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def selfie_points_list(request):
    cfg = PhotoSettings.get()
    points = SelfiePoint.objects.filter(is_active=True).prefetch_related('images', 'sponsors').order_by('name')
    mine = {s.selfie_point_id: s for s in SelfieSubmission.objects.filter(user=request.user).select_related('selfie_point')}
    return Response({
        'selfie_upload_open': cfg.selfie_upload_open,
        'points': [_selfie_point_data(sp, request, completed=(sp.id in mine and mine[sp.id].status == 'approved'), submission=mine.get(sp.id)) for sp in points]
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def selfie_upload(request):
    if not _is_checked_in(request.user):
        return Response({'error': 'Conference check-in required'}, status=403)
    cfg = PhotoSettings.get()
    if not cfg.selfie_upload_open:
        return Response({'error': 'Selfie spot challenges are currently closed.'}, status=403)
    point_id = request.data.get('selfie_point_id')
    user_lat = request.data.get('user_latitude')
    user_lng = request.data.get('user_longitude')
    image = request.FILES.get('image')
    if not point_id:
        return Response({'error': 'selfie_point_id is required'}, status=400)
    if user_lat is None or user_lng is None:
        return Response({'error': 'user_latitude and user_longitude are required'}, status=400)
    try:
        sp = SelfiePoint.objects.get(pk=point_id, is_active=True)
    except SelfiePoint.DoesNotExist:
        return Response({'error': 'Checkpoint not found or inactive'}, status=404)
    if SelfieSubmission.objects.filter(user=request.user, selfie_point=sp).exists():
        return Response({'error': 'You already submitted a check-in for this spot.'}, status=400)
    try:
        lat, lng = float(user_lat), float(user_lng)
    except (TypeError, ValueError):
        return Response({'error': 'Invalid coordinate numbers'}, status=400)

    if sp.checkpoint_type == 'selfie':
        if not image:
            return Response({'error': 'Selfie image file is required.'}, status=400)
        distance = _haversine_m(lat, lng, sp.latitude, sp.longitude)
        inside = distance <= float(sp.radius_meters)
        if not inside:
            return Response({'success': False, 'verified_in_geofence': False, 'distance_meters': round(distance, 1),
                             'error': f'You are {round(distance)}m away. Move within {sp.radius_meters}m.'}, status=403)
        try:
            sub = SelfieSubmission.objects.create(
                user=request.user, selfie_point=sp, photo=image,
                user_latitude=lat, user_longitude=lng,
                distance_meters=round(distance, 2), verified_in_geofence=True,
                status='pending', points_awarded=0
            )
            Photo.objects.create(uploader=request.user, image=image, caption=f"📸 Selfie Spot: {sp.name}", status=Photo.Status.PENDING)
        except IntegrityError:
            return Response({'error': 'You already submitted a check-in for this spot.'}, status=400)
        return Response({'success': True, 'verified_in_geofence': True, 'status': 'pending', 'points_awarded': 0,
                         'message': 'Selfie submitted! Awaiting admin verification.',
                         'submission': _selfie_point_data(sp, request, completed=False, submission=sub)['submission']}, status=201)
    else:
        inside = _is_in_corridor(lat, lng, sp.point_a_lat, sp.point_a_lng, sp.point_b_lat, sp.point_b_lng, sp.corridor_width_meters)
        if not inside:
            return Response({'success': False, 'verified_in_geofence': False,
                             'error': f'You are outside the corridor of "{sp.name}".'}, status=403)
        pts = sp.points or 10
        try:
            sub = SelfieSubmission.objects.create(
                user=request.user, selfie_point=sp, photo=None,
                user_latitude=lat, user_longitude=lng,
                distance_meters=0.0, verified_in_geofence=True,
                status='approved', points_awarded=pts, reviewed_at=timezone.now()
            )
            award_points(request.user, PointAction.PHOTO_UPLOAD, note=f'Sponsor Arena: {sp.name}', points_override=pts)
        except IntegrityError:
            return Response({'error': 'You already checked into this sponsor zone.'}, status=400)
        return Response({'success': True, 'verified_in_geofence': True, 'status': 'approved', 'points_awarded': pts,
                         'message': f'Welcome to {sp.name}! +{pts} points credited.',
                         'submission': _selfie_point_data(sp, request, completed=True, submission=sub)['submission']}, status=201)


# ── Mobile Admin API ───────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_sponsors_flat(request):
    if not _is_admin(request.user):
        return Response({'error': 'Forbidden'}, status=403)
    from apps.sponsors.models import Sponsor
    sponsors = Sponsor.objects.all().order_by('name')
    return Response({'sponsors': [{'id': s.id, 'name': s.name, 'stall_number': getattr(s, 'stall_number', None)} for s in sponsors]})


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def admin_checkpoints_list_create(request):
    if not _is_admin(request.user):
        return Response({'error': 'Forbidden'}, status=403)
    if request.method == 'GET':
        points = SelfiePoint.objects.prefetch_related('images', 'sponsors').all().order_by('-created_at')
        return Response({'checkpoints': [_selfie_point_data(sp, request) for sp in points]})

    cp_type = request.data.get('checkpoint_type', 'selfie')
    name = request.data.get('name', '').strip()
    description = request.data.get('description', '').strip()
    points_val = int(request.data.get('points') or 10)
    is_active = request.data.get('is_active') in ('true', 'True', True, 'on')
    if not name:
        return Response({'error': 'Name is required'}, status=400)

    if cp_type == 'selfie':
        lat = request.data.get('latitude')
        lng = request.data.get('longitude')
        rad = int(request.data.get('radius_meters') or 20)
        if not lat or not lng:
            return Response({'error': 'Latitude and Longitude required for selfie spot'}, status=400)
        sp = SelfiePoint.objects.create(
            name=name, description=description, checkpoint_type='selfie',
            latitude=lat, longitude=lng, radius_meters=rad, points=points_val, is_active=is_active,
        )
    else:
        pt_a_lat = request.data.get('point_a_lat')
        pt_a_lng = request.data.get('point_a_lng')
        pt_b_lat = request.data.get('point_b_lat')
        pt_b_lng = request.data.get('point_b_lng')
        corr_w = int(request.data.get('corridor_width_meters') or 30)
        if not pt_a_lat or not pt_a_lng or not pt_b_lat or not pt_b_lng:
            return Response({'error': 'Point A and Point B required for sponsor zone'}, status=400)
        sp = SelfiePoint.objects.create(
            name=name, description=description, checkpoint_type='sponsor_zone',
            point_a_lat=pt_a_lat, point_a_lng=pt_a_lng, point_b_lat=pt_b_lat, point_b_lng=pt_b_lng,
            corridor_width_meters=corr_w, points=points_val, is_active=is_active,
        )
        sponsor_ids = request.data.getlist('sponsors')
        if not sponsor_ids:
            import json
            try:
                sponsor_ids = json.loads(request.data.get('sponsors', '[]'))
            except Exception:
                pass
        if sponsor_ids:
            sp.sponsors.set(sponsor_ids)

    # Handle multiple reference images
    sample_photos = request.FILES.getlist('sample_photos')
    if not sample_photos:
        single = request.FILES.get('sample_photo')
        if single:
            sample_photos = [single]
    if sample_photos:
        sp.sample_photo = sample_photos[0]
        sp.save()
        for i, img in enumerate(sample_photos):
            SelfiePointImage.objects.create(selfie_point=sp, image=img, order=i)

    return Response({'success': True, 'checkpoint': _selfie_point_data(sp, request)}, status=201)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_checkpoint_toggle(request, pk):
    if not _is_admin(request.user):
        return Response({'error': 'Forbidden'}, status=403)
    try:
        sp = SelfiePoint.objects.get(pk=pk)
        sp.is_active = not sp.is_active
        sp.save()
        return Response({'success': True, 'is_active': sp.is_active})
    except SelfiePoint.DoesNotExist:
        return Response({'error': 'Not found'}, status=404)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def admin_checkpoint_delete(request, pk):
    if not _is_admin(request.user):
        return Response({'error': 'Forbidden'}, status=403)
    try:
        sp = SelfiePoint.objects.get(pk=pk)
        sp.delete()
        return Response({'success': True})
    except SelfiePoint.DoesNotExist:
        return Response({'error': 'Not found'}, status=404)
