from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Count, Q
from django.db import IntegrityError
import math

from apps.checkins.models import CheckIn
from apps.leaderboard.utils import award_points
from apps.leaderboard.models import PointAction
from .models import Photo, PhotoSettings, ScheduleSession, SelfiePoint, SelfieSubmission


def _is_checked_in(user):
    return CheckIn.objects.filter(user=user, checkin_type='conference').exists()


def _photo_data(photo, request):
    return {
        'id': photo.id,
        'image_url': request.build_absolute_uri(photo.image.url),
        'caption': photo.caption,
        'session_id': str(photo.session_id) if photo.session_id else None,
        'session_title': photo.session.title if photo.session_id else None,
        'uploader': photo.uploader.get_full_name() or photo.uploader.email.split('@')[0],
        'created_at': photo.created_at.isoformat(),
    }


# ── Public / Gallery ────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def gallery(request):
    """
    GET /api/v1/photos/gallery/
    ?session=<uuid>  — filter by session
    ?wall=1          — general wall only (no session)
    """
    if not _is_checked_in(request.user):
        return Response({'error': 'Conference check-in required'}, status=403)

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
    """
    POST /api/v1/photos/upload/
    Standard session/wall photo upload.
    """
    if not _is_checked_in(request.user):
        return Response({'error': 'Conference check-in required'}, status=403)

    settings = PhotoSettings.get()
    if not settings.upload_open:
        return Response({'error': 'Photo uploads are currently closed'}, status=403)

    image = request.FILES.get('image')
    if not image:
        return Response({'error': 'No image file received. Please pick an image and try again.'}, status=400)

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
        uploader=request.user,
        image=image,
        caption=request.data.get('caption', '').strip()[:300],
        session=session,
        status=status,
    )

    return Response({
        'id': photo.id,
        'status': photo.status,
        'auto_approved': settings.auto_approve,
        'message': 'Photo uploaded and approved!' if settings.auto_approve else 'Photo uploaded and pending admin approval.',
    }, status=201)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_photos(request):
    qs = Photo.objects.filter(uploader=request.user).select_related('session')
    return Response({
        'photos': [
            {
                **_photo_data(p, request),
                'status': p.status,
                'rejected_reason': p.rejected_reason,
            }
            for p in qs
        ]
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def sessions_with_photos(request):
    if not _is_checked_in(request.user):
        return Response({'error': 'Conference check-in required'}, status=403)

    sessions = ScheduleSession.objects.filter(
        photos__status=Photo.Status.APPROVED,
        is_published=True,
    ).annotate(photo_count=Count('photos')).order_by('day', 'start_datetime')

    return Response({
        'sessions': [
            {
                'id': str(s.id),
                'title': s.title,
                'day': s.day,
                'session_type': s.session_type,
                'photo_count': s.photo_count,
            }
            for s in sessions
        ]
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
        'upload_open': cfg.upload_open,
        'selfie_upload_open': cfg.selfie_upload_open,
        'auto_approve': cfg.auto_approve,
        'updated_at': cfg.updated_at.isoformat(),
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
        'photos': [
            {
                'id': p.id,
                'image_url': request.build_absolute_uri(p.image.url),
                'caption': p.caption,
                'uploader': p.uploader.get_full_name() or p.uploader.email,
                'uploader_email': p.uploader.email,
                'session_title': p.session.title if p.session else None,
                'status': p.status,
                'rejected_reason': p.rejected_reason,
                'created_at': p.created_at.isoformat(),
            }
            for p in qs
        ]
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

    if action == 'approve':
        try:
            already = Photo.objects.filter(
                uploader=photo.uploader,
                status=Photo.Status.APPROVED,
            ).exclude(pk=photo.pk).exists()
            if not already:
                award_points(photo.uploader, PointAction.PHOTO_UPLOAD, 'Photo approved')
        except Exception:
            pass

    return Response({'id': photo.id, 'status': photo.status})


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def admin_delete(request, pk):
    if not _is_admin(request.user):
        return Response({'error': 'Forbidden'}, status=403)
    try:
        Photo.objects.get(pk=pk).delete()
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
        'total': total,
        'pending': pending,
        'approved': approved,
        'rejected': rejected,
        'wall_count': wall_count,
        'sessions': [
            {
                'id': str(s.id),
                'title': s.title,
                'day': s.day,
                'session_type': s.session_type,
                'total_photos': s.total_photos,
                'pending_photos': s.pending_photos,
                'approved_photos': s.approved_photos,
            }
            for s in sessions
        ],
    })


# ── Selfie Spots ───────────────────────────────────────────────────

def _haversine_m(lat1, lon1, lat2, lon2):
    R = 6371000.0
    p1, p2 = math.radians(float(lat1)), math.radians(float(lat2))
    dp = math.radians(float(lat2) - float(lat1))
    dl = math.radians(float(lon2) - float(lon1))
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def _selfie_point_data(sp, request, completed=False, submission=None):
    sample = None
    if sp.sample_photo:
        try:
            sample = request.build_absolute_uri(sp.sample_photo.url)
        except Exception:
            sample = sp.sample_photo.url
    return {
        'id': sp.id,
        'name': sp.name,
        'description': sp.description,
        'latitude': float(sp.latitude),
        'longitude': float(sp.longitude),
        'radius_meters': sp.radius_meters,
        'points': sp.points,
        'sample_photo_url': sample,
        'is_active': sp.is_active,
        'completed': completed,
        'submission': (
            {
                'id': submission.id,
                'photo_url': request.build_absolute_uri(submission.photo.url),
                'distance_meters': submission.distance_meters,
                'verified_in_geofence': submission.verified_in_geofence,
                'created_at': submission.created_at.isoformat(),
            }
            if submission else None
        ),
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def selfie_points_list(request):
    cfg = PhotoSettings.get()
    points = SelfiePoint.objects.filter(is_active=True).order_by('name')
    mine = {
        s.selfie_point_id: s
        for s in SelfieSubmission.objects.filter(
            user=request.user,
            verified_in_geofence=True,
        ).select_related('selfie_point')
    }
    return Response({
        'selfie_upload_open': cfg.selfie_upload_open,
        'points': [
            _selfie_point_data(sp, request, completed=(sp.id in mine), submission=mine.get(sp.id))
            for sp in points
        ]
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def selfie_upload(request):
    if not _is_checked_in(request.user):
        return Response({'error': 'Conference check-in required'}, status=403)

    cfg = PhotoSettings.get()
    if not cfg.selfie_upload_open:
        return Response({'error': 'Selfie spot challenges are currently closed by the organizers.'}, status=403)

    point_id = request.data.get('selfie_point_id')
    user_lat = request.data.get('user_latitude')
    user_lng = request.data.get('user_longitude')
    image = request.FILES.get('image')

    if not point_id:
        return Response({'error': 'selfie_point_id is required'}, status=400)
    if user_lat is None or user_lng is None:
        return Response({'error': 'user_latitude and user_longitude are required'}, status=400)
    if not image:
        return Response({'error': 'No image file received. Please take a photo and try again.'}, status=400)

    content_type = getattr(image, 'content_type', '') or ''
    if content_type and not content_type.startswith('image/'):
        return Response({'error': 'Only image files are allowed.'}, status=400)
    if image.size > 10 * 1024 * 1024:
        return Response({'error': 'Image must be under 10 MB.'}, status=400)

    try:
        sp = SelfiePoint.objects.get(pk=point_id, is_active=True)
    except SelfiePoint.DoesNotExist:
        return Response({'error': 'Selfie point not found or inactive'}, status=404)

    if SelfieSubmission.objects.filter(
        user=request.user, selfie_point=sp, verified_in_geofence=True
    ).exists():
        return Response({'error': 'You already unlocked this selfie spot.'}, status=400)

    try:
        lat = float(user_lat)
        lng = float(user_lng)
    except (TypeError, ValueError):
        return Response({'error': 'Invalid coordinates'}, status=400)

    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        return Response({'error': 'Coordinates out of range'}, status=400)

    distance = _haversine_m(lat, lng, sp.latitude, sp.longitude)
    inside = distance <= float(sp.radius_meters)

    if not inside:
        return Response({
            'success': False,
            'verified_in_geofence': False,
            'distance_meters': round(distance, 1),
            'radius_meters': sp.radius_meters,
            'error': (
                f'You are {round(distance)}m away. '
                f'Move within {sp.radius_meters}m of "{sp.name}" to upload.'
            ),
        }, status=403)

    try:
        submission = SelfieSubmission.objects.create(
            user=request.user,
            selfie_point=sp,
            photo=image,
            user_latitude=lat,
            user_longitude=lng,
            distance_meters=round(distance, 2),
            verified_in_geofence=True,
        )

        # Replicate to the public Photo Wall (PENDING — admin must approve at /panel/photos/)
        Photo.objects.create(
            uploader=request.user,
            image=submission.photo,
            caption=f"📸 Selfie Spot: {sp.name}",
            status=Photo.Status.PENDING,
        )

    except IntegrityError:
        return Response({'error': 'You already unlocked this selfie spot.'}, status=400)

    points_to_award = sp.points if sp.points else 10
    try:
        award_points(
            request.user,
            PointAction.PHOTO_UPLOAD,
            note=f'Selfie spot: {sp.name}',
            points_override=points_to_award,
        )
    except Exception as e:
        print(f"Error awarding selfie points: {e}")

    return Response({
        'success': True,
        'verified_in_geofence': True,
        'distance_meters': round(distance, 1),
        'radius_meters': sp.radius_meters,
        'points_awarded': points_to_award,
        'submission': _selfie_point_data(sp, request, completed=True, submission=submission)['submission'],
        'message': f'Selfie verified at {sp.name}! +{points_to_award} points awarded.',
    }, status=201)
