from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model

from .serializers import LoginSerializer, UserSerializer, ChangePasswordSerializer

User = get_user_model()


@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    user = serializer.validated_data['user']
    refresh = RefreshToken.for_user(user)

    return Response({
        'success': True,
        'message': 'Login successful',
        'tokens': {
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        },
        'user': UserSerializer(user, context={'request': request}).data,
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me_view(request):
    return Response({
        'success': True,
        'user': UserSerializer(request.user, context={'request': request}).data,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password_view(request):
    serializer = ChangePasswordSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    user = request.user
    if not user.check_password(serializer.validated_data['old_password']):
        return Response({
            'success': False,
            'message': 'Current password is incorrect.',
        }, status=status.HTTP_400_BAD_REQUEST)

    user.set_password(serializer.validated_data['new_password'])
    user.must_change_password = False
    user.save()

    refresh = RefreshToken.for_user(user)

    return Response({
        'success': True,
        'message': 'Password changed successfully.',
        'tokens': {
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        },
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def update_profile_view(request):
    user = request.user
    was_complete = user.profile_complete

    serializer = UserSerializer(user, data=request.data, partial=True, context={'request': request})
    serializer.is_valid(raise_exception=True)
    serializer.save()

    # Refresh from DB to get updated fields
    user.refresh_from_db()

    # Check profile completion
    is_now_complete = all([
        user.first_name,
        user.last_name,
        user.affiliation,
        user.bio or user.research_interests,
    ])

    points_awarded = 0

    if is_now_complete and not was_complete:
        user.profile_complete = True
        user.save(update_fields=['profile_complete'])
        # Award points for profile completion
        try:
            from apps.leaderboard.utils import award_points
            from apps.leaderboard.models import PointAction, PointEntry
            if not PointEntry.objects.filter(user=user, action=PointAction.PROFILE_COMPLETION).exists():
                award_points(user, PointAction.PROFILE_COMPLETION, 'Profile completed')
                points_awarded = 50
        except Exception:
            pass
    elif not is_now_complete and was_complete:
        user.profile_complete = False
        user.save(update_fields=['profile_complete'])

    response_data = {
        'success': True,
        'message': 'Profile updated.',
        'user': UserSerializer(user, context={'request': request}).data,
    }

    if points_awarded > 0:
        response_data['points_awarded'] = points_awarded
        response_data['points_message'] = f'🎉 +{points_awarded} points for completing your profile!'

    return Response(response_data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    try:
        refresh_token = request.data.get('refresh')
        if refresh_token:
            token = RefreshToken(refresh_token)
            token.blacklist()
    except Exception:
        pass

    return Response({
        'success': True,
        'message': 'Logged out successfully.',
    })


ADMIN_ROLES = ('super_admin', 'mgmt_admin')


def _is_admin(user):
    return hasattr(user, 'role') and user.role in ADMIN_ROLES


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_list_view(request):
    """All users — admin only. Supports ?search= and ?role= filters."""
    if not _is_admin(request.user):
        return Response({'error': 'Permission denied'}, status=403)

    qs = User.objects.all().order_by('role', 'first_name', 'last_name')

    search = request.query_params.get('search', '').strip()
    role   = request.query_params.get('role', '').strip()
    if search:
        from django.db.models import Q
        qs = qs.filter(
            Q(first_name__icontains=search) |
            Q(last_name__icontains=search)  |
            Q(email__icontains=search)      |
            Q(registration_id__icontains=search)
        )
    if role:
        qs = qs.filter(role=role)

    data = []
    for u in qs:
        photo = None
        if u.profile_photo:
            try:    photo = request.build_absolute_uri(u.profile_photo.url)
            except: pass
        data.append({
            'id':              str(u.id),
            'email':           u.email,
            'registration_id': u.registration_id or '',
            'first_name':      u.first_name,
            'last_name':       u.last_name,
            'role':            u.role,
            'affiliation':     u.affiliation,
            'is_active':       u.is_active,
            'warning_note':    u.warning_note,
            'suspended_reason':u.suspended_reason,
            'profile_photo_url': photo,
            'created_at':      u.created_at.isoformat(),
        })
    return Response({'users': data, 'total': len(data)})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def user_action_view(request, pk):
    """
    Warn, suspend, or unsuspend a user.
    Body: { action: 'warn'|'suspend'|'unsuspend', note: '...' }
    Admins cannot act on other admins.
    """
    if not _is_admin(request.user):
        return Response({'error': 'Permission denied'}, status=403)

    try:
        target = User.objects.get(pk=pk)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=404)

    if target.role in ADMIN_ROLES:
        return Response({'error': 'Cannot moderate admin accounts'}, status=400)

    action = request.data.get('action', '').strip()
    note   = request.data.get('note', '').strip()

    if action == 'warn':
        if not note:
            return Response({'error': 'note is required for a warning'}, status=400)
        target.warning_note = note
        target.save(update_fields=['warning_note'])
        # Send push notification to warned user
        try:
            from apps.notifications.models import Notification as Notif
            from apps.notifications import fcm
            notif = Notif.objects.create(
                title='⚠️ Warning from Admin',
                body=note,
                target_type='user',
                target_user=target,
                sent_by=request.user,
                status='pending',
                data={'type': 'admin_warning'},
            )
            success, failed, bad = fcm.send_to_user(target, notif.title, notif.body, notif.data, notif)
            notif.status = 'sent'; notif.sent_count = success; notif.failed_count = failed; notif.save()
        except Exception:
            pass  # non-critical — warning is stored on user regardless
        return Response({'success': True, 'action': 'warned', 'note': note})

    elif action == 'suspend':
        reason = note or 'Account suspended by admin.'
        target.is_active        = False
        target.suspended_reason = reason
        target.save(update_fields=['is_active', 'suspended_reason'])
        # blacklist all tokens — force immediate logout
        try:
            from apps.notifications.models import DeviceToken
            DeviceToken.objects.filter(user=target).update(is_active=False)
        except Exception:
            pass
        # Send suspension email
        try:
            from django.core.mail import send_mail
            send_mail(
                subject='ETD 2026 — Account Suspended',
                message=(
                    f"Dear {target.get_full_name() or target.email},\n\n"
                    f"Your ETD 2026 account has been suspended.\n\n"
                    f"Reason: {reason}\n\n"
                    f"If you believe this is a mistake, please contact the organizing team.\n\n"
                    f"Regards,\nETD 2026 Organising Committee\nIIT Delhi"
                ),
                from_email=None,
                recipient_list=[target.email],
                fail_silently=True,
            )
        except Exception:
            pass  # non-critical
        return Response({'success': True, 'action': 'suspended'})

    elif action == 'unsuspend':
        target.is_active        = True
        target.suspended_reason = ''
        target.save(update_fields=['is_active', 'suspended_reason'])
        return Response({'success': True, 'action': 'unsuspended'})

    return Response({'error': 'action must be warn | suspend | unsuspend'}, status=400)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def participant_create_view(request):
    """
    Admin-only: create a single participant account.
    Body: { first_name, last_name, email, registration_id(opt),
            phone, affiliation, designation, gender, send_email }
    Registration ID auto-generated (ETD-2026-S-XXX) if not provided.
    """
    if not _is_admin(request.user):
        return Response({'error': 'Permission denied'}, status=403)

    email = (request.data.get('email') or '').strip().lower()
    first_name = (request.data.get('first_name') or '').strip()
    last_name  = (request.data.get('last_name') or '').strip()

    if not email or '@' not in email:
        return Response({'error': 'Valid email is required.'}, status=400)
    if not first_name:
        return Response({'error': 'First name is required.'}, status=400)

    if User.objects.filter(email=email).exists():
        return Response({'error': f'Email {email} is already registered.'}, status=400)

    # Auto-generate reg ID if not supplied
    reg_id = (request.data.get('registration_id') or '').strip() or None
    if reg_id and User.objects.filter(registration_id=reg_id).exists():
        return Response({'error': f'Registration ID {reg_id} already exists.'}, status=400)

    if not reg_id:
        # replicate _next_single_reg_id logic inline — no import needed
        last = (
            User.objects.filter(registration_id__startswith='ETD-2026-S-')
            .order_by('-registration_id')
            .values_list('registration_id', flat=True)
            .first()
        )
        try:
            num = int(last.split('-')[-1]) + 1 if last else 1
        except (ValueError, AttributeError):
            num = 1
        reg_id = f'ETD-2026-S-{num:03d}'

    import secrets, string
    alphabet = string.ascii_letters + string.digits
    while True:
        temp_password = ''.join(secrets.choice(alphabet) for _ in range(12))
        if (any(c.isupper() for c in temp_password)
                and any(c.islower() for c in temp_password)
                and any(c.isdigit() for c in temp_password)):
            break

    try:
        user = User.objects.create_user(
            email           = email,
            password        = temp_password,
            first_name      = first_name,
            last_name       = last_name,
            phone           = (request.data.get('phone') or '').strip(),
            affiliation     = (request.data.get('affiliation') or '').strip(),
            designation     = (request.data.get('designation') or '').strip(),
            gender          = (request.data.get('gender') or '').strip(),
            registration_id = reg_id,
            role            = 'participant',
            must_change_password = True,
            is_active       = True,
        )
    except Exception as exc:
        return Response({'error': str(exc)}, status=400)

    # Award signup points — non-critical
    try:
        from apps.leaderboard.utils import award_points
        from apps.leaderboard.models import PointAction
        award_points(user, PointAction.SIGNUP, 'Welcome to ETD 2026')
    except Exception:
        pass

    # Email — only if requested
    if request.data.get('send_email'):
        try:
            from django.core.mail import send_mail
            send_mail(
                subject='ETD 2026 — Your Login Credentials',
                message=(
                    f"Dear {user.get_full_name()},\n\n"
                    f"Welcome to ETD 2026!\n\n"
                    f"  Email:    {email}\n"
                    f"  Password: {temp_password}\n\n"
                    f"Login at: https://etd2026.iitd.ac.in\n\n"
                    f"IMPORTANT: You will be asked to change your password on first login.\n\n"
                    f"Regards,\nETD 2026 Organising Committee\nIIT Delhi"
                ),
                from_email=None,
                recipient_list=[email],
                fail_silently=True,
            )
        except Exception:
            pass

    return Response({
        'success':         True,
        'message':         f'{user.get_full_name()} created successfully.',
        'registration_id': reg_id,
        'email':           email,
    }, status=201)

# Add to bottom of backend/apps/accounts/views.py

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def discover_view(request):
    """
    GET /api/v1/accounts/discover/
    Returns checked-in attendees sorted by research interest overlap
    with the requesting user. Also returns interest_cloud.
    """
    from django.db.models import Q
    from apps.checkins.models import CheckIn

    me = request.user
    my_tags = {t.strip().lower() for t in (me.research_interests or '').split(',') if t.strip()}

    # Checked-in non-admin participants (same queryset logic as network_list)
    checked_in_ids = CheckIn.objects.filter(
        checkin_type='conference'
    ).values_list('user_id', flat=True)

    qs = User.objects.filter(
        is_active=True,
        id__in=checked_in_ids,
    ).exclude(
        id=me.id
    ).exclude(
        role__in=['super_admin', 'mgmt_admin']
    ).only(
        'id', 'first_name', 'last_name', 'affiliation',
        'designation', 'profile_photo', 'research_interests', 'role',
    )

    # Build interest cloud (all interests → count of people)
    cloud = {}
    matches = []

    for u in qs:
        their_tags = {t.strip().lower() for t in (u.research_interests or '').split(',') if t.strip()}

        # Populate cloud regardless of overlap
        for tag in their_tags:
            cloud[tag] = cloud.get(tag, 0) + 1

        if not their_tags:
            continue

        common = sorted(my_tags & their_tags)   # sorted for stable output
        if not common:
            continue

        photo = None
        if u.profile_photo:
            try:
                photo = request.build_absolute_uri(u.profile_photo.url)
            except Exception:
                pass

        matches.append({
            'id':               str(u.id),
            'name':             u.get_full_name(),
            'affiliation':      u.affiliation or '',
            'designation':      u.designation or '',
            'profile_photo_url': photo,
            'role':             u.role,
            'common_interests': common,
            'all_interests':    sorted(their_tags),
            'match_score':      len(common),
        })

    matches.sort(key=lambda x: x['match_score'], reverse=True)

    return Response({
        'my_interests':    sorted(my_tags),
        'matches':         matches,
        'match_count':     len(matches),
        'interest_cloud':  sorted(cloud.items(), key=lambda x: x[1], reverse=True),
        'has_interests':   bool(my_tags),
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_recap_view(request):
    from django.utils import timezone
    from apps.leaderboard.models import PointEntry, UserPoints, PointAction
    from apps.photos.models import Photo
    from apps.polls.models import Vote
    from apps.polls.ideathon_models import IdeathonMember
    from apps.schedule.models import SessionBookmark

    user = request.user

    # ── Determine conference day ──────────────────────────────────────
    day_param = request.GET.get('day')
    if day_param and day_param in ('1', '2', '3'):
        day = int(day_param)
    else:
        # Auto-detect from conference dates
        from datetime import date
        DAY_MAP = {
            date(2026, 10, 23): 1,
            date(2026, 10, 24): 2,
            date(2026, 10, 25): 3,
        }
        today = timezone.localdate()
        day = DAY_MAP.get(today, 1)

    # ── Date range for selected day (IST) ────────────────────────────
    from datetime import date, timedelta
    from django.utils.timezone import make_aware
    import datetime as dt
    DAY_DATES = {1: date(2026, 10, 23), 2: date(2026, 10, 24), 3: date(2026, 10, 25)}
    day_date  = DAY_DATES[day]
    ist_offset = dt.timezone(dt.timedelta(hours=5, minutes=30))
    day_start = dt.datetime(day_date.year, day_date.month, day_date.day, 0, 0, 0, tzinfo=ist_offset)
    day_end   = day_start + dt.timedelta(days=1)

    # ── Point entries for today ───────────────────────────────────────
    entries_today = PointEntry.objects.filter(
        user=user,
        created_at__gte=day_start,
        created_at__lt=day_end,
    )
    points_today = sum(e.points for e in entries_today)
    connections_today = entries_today.filter(action=PointAction.NETWORKING).count()

    # ── Total points + rank ───────────────────────────────────────────
    try:
        up = UserPoints.objects.get(user=user)
        total_points = up.total_points
        rank = up.rank
    except UserPoints.DoesNotExist:
        total_points = 0
        rank = None

    # ── Bookmarked sessions for this day ─────────────────────────────
    bookmarks = SessionBookmark.objects.filter(
        user=user,
        session__day=day,
    ).select_related('session').order_by('session__start_datetime')

    bookmarked = []
    for b in bookmarks:
        s = b.session
        bookmarked.append({
            'title': s.title,
            'time': s.start_datetime.astimezone(ist_offset).strftime('%H:%M') if s.start_datetime else '',
            'session_type': s.session_type,
        })

    # ── Photos uploaded today ─────────────────────────────────────────
    photos_today = Photo.objects.filter(
        uploader=user,
        created_at__gte=day_start,
        created_at__lt=day_end,
    ).count()

    # ── Polls voted today ─────────────────────────────────────────────
    polls_today = Vote.objects.filter(
        user=user,
        created_at__gte=day_start,
        created_at__lt=day_end,
    ).count()

    # ── Ideathon team ─────────────────────────────────────────────────
    team_name = None
    try:
        m = IdeathonMember.objects.select_related('team').get(user=user)
        team_name = m.team.name
    except IdeathonMember.DoesNotExist:
        pass

    # ── Highlight string ──────────────────────────────────────────────
    highlight = None
    if rank and rank <= 3:
        highlight = f"🏆 You're in the Top 3 at ETD 2026!"
    elif rank and rank <= 10:
        highlight = f"🔥 You're in the Top 10 — amazing!"
    elif connections_today >= 3:
        highlight = f"🤝 Super networker — {connections_today} connections today!"
    elif points_today >= 50:
        highlight = f"⚡ Power day — {points_today} points earned!"
    elif bookmarked:
        highlight = f"📅 You bookmarked {len(bookmarked)} session{'s' if len(bookmarked) != 1 else ''} today."
    else:
        highlight = "🌟 Great to have you at ETD 2026!"

    return Response({
        'day': day,
        'points_earned_today': points_today,
        'total_points': total_points,
        'rank': rank,
        'sessions_bookmarked': bookmarked,
        'sessions_bookmarked_count': len(bookmarked),
        'photos_uploaded': photos_today,
        'polls_voted': polls_today,
        'connections_made': connections_today,
        'team': team_name,
        'highlight': highlight,
    })
