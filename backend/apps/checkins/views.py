import json
from django.utils import timezone
from django.utils.timezone import localdate
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.contrib.auth import get_user_model

from .models import CheckIn, MealPass, MealWindow

User = get_user_model()
SCANNER_ROLES = {'super_admin', 'mgmt_admin', 'team_head', 'staff'}


def _public_media_url(request, path):
    if not path:
        return None
    public_origin = (
        request.headers.get('x-public-origin')
        or request.META.get('HTTP_X_PUBLIC_ORIGIN')
        or ''
    ).strip()
    if public_origin:
        return public_origin.rstrip('/') + path
    try:
        return request.build_absolute_uri(path)
    except Exception:
        return path


def _user_detail(user, request):
    photo = None
    if user.profile_photo:
        try:
            photo = _public_media_url(request, user.profile_photo.url)
        except Exception:
            pass
    return {
        'id':                str(user.id),
        'name':              user.get_full_name(),
        'email':             user.email,
        'registration_id':   user.registration_id,
        'role':              user.role,
        'affiliation':       user.affiliation or '',
        'designation':       user.designation or '',
        'profile_photo_url': photo,
        'research_interests': user.research_interests or '',
    }


def _award(user, action_key, note):
    """Award leaderboard points. Silent on any error."""
    try:
        from apps.leaderboard.utils import award_points
        from apps.leaderboard.models import PointAction, PointEntry
        if not PointEntry.objects.filter(user=user, action=action_key).exists():
            award_points(user, action_key, note)
            return 10
    except Exception:
        pass
    return 0


def _push_user(user, title, body, data=None):
    """Send push to a single user's device tokens. Silent on error."""
    try:
        from apps.notifications.models import DeviceToken
        from apps.notifications import fcm
        tokens = list(DeviceToken.objects.filter(user=user, is_active=True).values_list('token', flat=True))
        if tokens:
            fcm.send_to_tokens(tokens, title, body, data or {})
    except Exception:
        pass


# ── Conference Check-In ────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def scan_checkin(request):
    if request.user.role not in SCANNER_ROLES:
        return Response({'success': False, 'message': 'Not authorised.'}, status=403)

    reg_id = request.data.get('registration_id', '').strip()
    qr_raw = request.data.get('qr_data', '').strip()

    if not reg_id and qr_raw:
        try:
            payload = json.loads(qr_raw)
            reg_id  = payload.get('reg', '').strip()
        except (json.JSONDecodeError, AttributeError):
            reg_id = qr_raw

    if not reg_id:
        return Response({'success': False, 'message': 'No registration ID provided.'}, status=400)

    try:
        user = User.objects.get(registration_id=reg_id, is_active=True)
    except User.DoesNotExist:
        return Response({'success': False, 'message': f'No active user found with ID "{reg_id}".'}, status=404)

    existing = CheckIn.objects.filter(user=user, checkin_type='conference').first()
    if existing:
        return Response({
            'success': False, 'already_in': True,
            'message': f'{user.get_full_name()} is already checked in.',
            'scanned_at':     existing.scanned_at,
            'goodies_status': existing.goodies_status,
            'checkin_id':     existing.id,
            'user':           _user_detail(user, request),
        })

    checkin = CheckIn.objects.create(
        user=user, checkin_type='conference',
        scanned_by=request.user, goodies_status='pending',
    )

    points_awarded = _award(user, 'CHECKIN', 'Conference check-in')

    # Push notification to the user's device
    _push_user(
        user,
        title='✅ Check-In Successful!',
        body=f'Welcome to ETD 2026, {user.first_name}! You have been checked in successfully.',
        data={'type': 'checkin', 'points': str(points_awarded)},
    )

    return Response({
        'success':        True,
        'message':        f'{user.get_full_name()} checked in successfully!',
        'points_awarded': points_awarded,
        'scanned_at':     checkin.scanned_at,
        'goodies_pending': True,
        'checkin_id':     checkin.id,
        'user':           _user_detail(user, request),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def confirm_goodies(request):
    if request.user.role not in SCANNER_ROLES:
        return Response({'success': False, 'message': 'Not authorised.'}, status=403)

    checkin_id = request.data.get('checkin_id')
    received   = request.data.get('received', False)
    note       = request.data.get('note', '').strip()

    try:
        checkin = CheckIn.objects.get(id=checkin_id)
    except CheckIn.DoesNotExist:
        return Response({'success': False, 'message': 'Check-in not found.'}, status=404)

    checkin.goodies_status       = 'received' if received else 'skipped'
    checkin.goodies_note         = note
    checkin.goodies_confirmed_by = request.user
    checkin.goodies_confirmed_at = timezone.now()
    checkin.save(update_fields=[
        'goodies_status', 'goodies_note',
        'goodies_confirmed_by', 'goodies_confirmed_at',
    ])

    return Response({
        'success':        True,
        'message':        f'Conference Kit {"received" if received else "skipped"}.',
        'goodies_status': checkin.goodies_status,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def checkin_status(request):
    checkin = CheckIn.objects.filter(user=request.user, checkin_type='conference').first()
    return Response({
        'checked_in':     checkin is not None,
        'scanned_at':     checkin.scanned_at if checkin else None,
        'points_awarded': 10 if checkin else 0,
        'goodies_status': checkin.goodies_status if checkin else None,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def checkin_list(request):
    if request.user.role not in SCANNER_ROLES:
        return Response({'success': False, 'message': 'Not authorised.'}, status=403)

    qs = CheckIn.objects.filter(
        checkin_type='conference'
    ).select_related('user', 'scanned_by').order_by('-scanned_at')

    data = [{
        'checkin_id':     c.id,
        'user':           _user_detail(c.user, request),
        'scanned_by':     c.scanned_by.get_full_name() if c.scanned_by else 'System',
        'scanned_at':     c.scanned_at,
        'goodies_status': c.goodies_status,
        'goodies_note':   c.goodies_note,
    } for c in qs]

    return Response({'count': len(data), 'checkins': data})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_qr(request):
    u = request.user
    return Response({
        'qr_data':         json.dumps({'type': 'conference', 'reg': str(u.registration_id or u.id)}),
        'registration_id': str(u.registration_id or ''),
        'name':            u.get_full_name(),
        'role':            u.role,
        'affiliation':     u.affiliation or '',
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def network_list(request):
    from django.db.models import Q

    search      = request.GET.get('search', '').strip()
    interest    = request.GET.get('interest', '').strip().lower()
    role_filter = request.GET.get('role', '').strip()

    if role_filter == 'speaker':
        qs = User.objects.filter(is_active=True, role='speaker').order_by('first_name', 'last_name')
    else:
        checked_in_ids = CheckIn.objects.filter(
            checkin_type='conference'
        ).values_list('user_id', flat=True)
        qs = User.objects.filter(
            is_active=True, id__in=checked_in_ids,
        ).exclude(role__in=['speaker', 'super_admin', 'mgmt_admin']).order_by('first_name', 'last_name')

    if search:
        qs = qs.filter(
            Q(first_name__icontains=search) | Q(last_name__icontains=search) |
            Q(affiliation__icontains=search) | Q(registration_id__icontains=search)
        )
    if interest:
        qs = qs.filter(research_interests__icontains=interest)

    data = [_user_detail(u, request) for u in qs]

    all_interests = set()
    for u in qs:
        for tag in (u.research_interests or '').split(','):
            tag = tag.strip()
            if tag:
                all_interests.add(tag)

    return Response({'count': len(data), 'attendees': data, 'interests': sorted(all_interests)})


# ── Meal Pass ─────────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def meal_status(request):
    today   = localdate()
    # Only return open 'meal' windows (unified type)
    windows = MealWindow.objects.filter(date=today, is_open=True, meal_type='meal')

    result = []
    for w in windows:
        mp = MealPass.objects.filter(
            user=request.user, meal_type='meal', date=today
        ).first()
        result.append({
            'meal_type':   'meal',
            'date':        str(today),
            'window_open': True,
            'pass_exists': mp is not None,
            'pass_used':   mp.used if mp else False,
            'pass_id':     str(mp.id) if mp else None,
        })

    return Response({'windows': result, 'date': str(today)})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_meal_pass(request):
    today = localdate()

    window = MealWindow.objects.filter(meal_type='meal', date=today, is_open=True).first()
    if not window:
        return Response({
            'success': False,
            'message': 'Meal pass window is not open yet. Wait for admin to open it.',
        }, status=400)

    if not CheckIn.objects.filter(user=request.user, checkin_type='conference').exists():
        return Response({
            'success': False,
            'message': 'You must complete conference check-in before generating a meal pass.',
        }, status=400)

    mp, created = MealPass.objects.get_or_create(
        user=request.user, meal_type='meal', date=today,
    )

    qr_payload = json.dumps({
        'type':    'meal',
        'meal':    'meal',
        'date':    str(today),
        'pass_id': str(mp.id),
        'reg':     str(request.user.registration_id or request.user.id),
    })

    return Response({
        'success':   True,
        'created':   created,
        'pass_id':   str(mp.id),
        'meal_type': 'meal',
        'date':      str(today),
        'used':      mp.used,
        'qr_data':   qr_payload,
        'message':   f'{"Generated" if created else "Existing"} meal pass for {today}.',
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def scan_meal(request):
    if request.user.role not in SCANNER_ROLES:
        return Response({'success': False, 'message': 'Not authorised.'}, status=403)

    qr_raw    = request.data.get('qr_data', '').strip()
    reg_id    = request.data.get('registration_id', '').strip()
    meal_type = request.data.get('meal_type', 'meal').strip().lower()
    pass_id   = None
    today     = localdate()

    if qr_raw:
        try:
            payload   = json.loads(qr_raw)
            pass_id   = payload.get('pass_id')
            meal_type = payload.get('meal', meal_type)
            reg_id    = payload.get('reg', reg_id)
        except (json.JSONDecodeError, AttributeError):
            pass

    mp = None
    if pass_id:
        mp = MealPass.objects.select_related('user').filter(id=pass_id).first()
    elif reg_id:
        try:
            user = User.objects.get(registration_id=reg_id, is_active=True)
            # Try unified 'meal' first, fall back to whatever exists today
            mp = (
                MealPass.objects.select_related('user').filter(user=user, meal_type='meal', date=today).first()
                or MealPass.objects.select_related('user').filter(user=user, date=today).first()
            )
        except User.DoesNotExist:
            return Response({'success': False, 'message': f'No user with ID "{reg_id}".'}, status=404)

    if not mp:
        return Response({
            'success': False,
            'message': 'No meal pass found. User may not have generated a pass.',
        }, status=404)

    if mp.used:
        return Response({
            'success':     False,
            'already_used': True,
            'message':     f'{mp.user.get_full_name()} already used this meal pass.',
            'used_at':     mp.used_at,
            'user':        _user_detail(mp.user, request),
        })

    mp.used       = True
    mp.used_at    = timezone.now()
    mp.scanned_by = request.user
    mp.save(update_fields=['used', 'used_at', 'scanned_by'])

    # Award points for meal scan
    points = _award(mp.user, 'MEAL_SCAN', 'Meal pass scanned')

    # Push to user
    _push_user(
        mp.user,
        title='🍽️ Meal Pass Verified!',
        body=f'Your meal pass has been scanned. Enjoy your meal!',
        data={'type': 'meal_scan', 'points': str(points)},
    )

    return Response({
        'success':        True,
        'message':        f'{mp.user.get_full_name()} — Meal pass verified!',
        'meal_type':      mp.meal_type,
        'used_at':        mp.used_at,
        'points_awarded': points,
        'user':           _user_detail(mp.user, request),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def meal_window_toggle(request):
    if request.user.role not in SCANNER_ROLES:
        return Response({'success': False, 'message': 'Not authorised.'}, status=403)

    # Always use unified 'meal' type
    meal_type = 'meal'
    action    = request.data.get('action', 'open')
    today     = localdate()

    if action == 'open':
        window, created = MealWindow.objects.get_or_create(
            meal_type=meal_type, date=today,
            defaults={'opened_by': request.user, 'is_open': True},
        )
        reopened = False
        if not created and not window.is_open:
            window.is_open   = True
            window.opened_by = request.user
            window.closed_at = None
            window.save(update_fields=['is_open', 'opened_by', 'closed_at'])
            reopened = True

        if created or reopened:
            _send_meal_notification(today, request.user, request)

        return Response({'success': True, 'message': f'Meal pass window opened for {today}.', 'is_open': True})
    else:
        MealWindow.objects.filter(meal_type=meal_type, date=today).update(
            is_open=False, closed_at=timezone.now()
        )
        return Response({'success': True, 'message': 'Meal pass window closed.', 'is_open': False})


def _send_meal_notification(date, sent_by, request=None):
    try:
        from apps.notifications.models import Notification, DeviceToken
        from apps.notifications import fcm

        title = '🍽️ Meal Pass Now Open!'
        body  = f'Meal passes are now available for {date}. Open your QR tab to generate your pass.'

        notif = Notification.objects.create(
            title=title, body=body, target_type='all',
            sent_by=sent_by, status='pending',
            data={'type': 'meal_window', 'date': str(date)},
        )

        success, failed, bad = fcm.send_to_all(title, body, notif.data, notif, request)

        if bad:
            DeviceToken.objects.filter(token__in=bad).update(is_active=False)

        notif.status       = 'sent'
        notif.sent_count   = success
        notif.failed_count = failed
        notif.save(update_fields=['status', 'sent_count', 'failed_count'])
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f'Meal notification error: {e}')


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def meal_stats(request):
    if request.user.role not in SCANNER_ROLES:
        return Response({'success': False, 'message': 'Not authorised.'}, status=403)

    today = localdate()
    total = MealPass.objects.filter(date=today).count()
    used  = MealPass.objects.filter(date=today, used=True).count()

    return Response({
        'date':  str(today),
        'total': total,
        'used':  used,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def meal_list(request):
    """GET /api/v1/checkins/meal/list/ — all meal passes for today (admin)"""
    if request.user.role not in SCANNER_ROLES:
        return Response({'success': False, 'message': 'Not authorised.'}, status=403)

    from django.utils.timezone import localdate
    today = localdate()
    qs    = MealPass.objects.filter(date=today).select_related('user', 'scanned_by').order_by('-created_at')

    data = [{
        'pass_id':   str(p.id),
        'meal_type': p.meal_type,
        'date':      str(p.date),
        'used':      p.used,
        'used_at':   p.used_at,
        'user':      _user_detail(p.user, request),
        'scanned_by': p.scanned_by.get_full_name() if p.scanned_by else None,
    } for p in qs]

    return Response({'count': len(data), 'passes': data})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def checked_in_participants(request):
    """Search checked-in participants by name/email. Used for Ideathon team formation."""
    from apps.accounts.models import User
    from django.db.models import Q
    search = request.query_params.get('search', '').strip()
    checkin_user_ids = CheckIn.objects.filter(
        checkin_type='conference'
    ).values_list('user_id', flat=True)
    qs = User.objects.filter(id__in=checkin_user_ids, is_active=True)
    if search:
        qs = qs.filter(
            Q(first_name__icontains=search) |
            Q(last_name__icontains=search) |
            Q(email__icontains=search) |
            Q(affiliation__icontains=search)
        )
    users = []
    for u in qs[:30]:
        users.append({
            'id': str(u.id),
            'name': u.get_full_name() or u.email.split('@')[0],
            'email': u.email,
            'affiliation': u.affiliation or '',
        })
    return Response({'users': users, 'count': len(users)})
