from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.throttling import AnonRateThrottle
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
import html
import re

from .serializers import LoginSerializer, UserSerializer, ChangePasswordSerializer

User = get_user_model()


def sanitize_input(val):
    if not isinstance(val, str):
        return val
    cleaned = re.sub(r'<[^>]*?>', '', val)
    return html.escape(cleaned.strip())


def calculate_profile_completeness(user):
    """
    Calculates profile completeness percentage (0-100) and missing requirements.
    Weights:
      1. First & Last Name:       15%
      2. Profile Photo:           15%
      3. Affiliation:             15%
      4. Designation:             10%
      5. Bio (>= 20 chars):       15%
      6. Research Interests (3-5): 20%
      7. Contact (LinkedIn/Phone): 10%
      Total: 100%
    """
    score = 0
    missing = []

    # 1. Names (15)
    if user.first_name and user.last_name:
        score += 15
    elif user.first_name:
        score += 8
        missing.append('Last name')
    else:
        missing.append('First and last name')

    # 2. Photo (15)
    has_photo = bool(user.profile_photo) or (
        hasattr(user, 'staff_profile') and user.staff_profile and bool(user.staff_profile.photo)
    )
    if has_photo:
        score += 15
    else:
        missing.append('Profile photo')

    # 3. Affiliation (15)
    if user.affiliation and len(user.affiliation.strip()) >= 2:
        score += 15
    else:
        missing.append('Affiliation or Organisation')

    # 4. Designation (10)
    if user.designation and len(user.designation.strip()) >= 2:
        score += 10
    else:
        missing.append('Designation or Role')

    # 5. Bio (15) - substantive length
    bio_clean = (user.bio or '').strip()
    if len(bio_clean) >= 20:
        score += 15
    elif len(bio_clean) > 0:
        score += 5
        missing.append('Bio (at least 20 characters)')
    else:
        missing.append('Short bio (at least 20 characters)')

    # 6. Research Interests (20) - 3 to 5 tags
    tags = [t.strip() for t in (user.research_interests or '').split(',') if t.strip()]
    if len(tags) >= 3:
        score += 20
    elif len(tags) == 2:
        score += 12
        missing.append('1 more research interest (minimum 3)')
    elif len(tags) == 1:
        score += 6
        missing.append('2 more research interests (minimum 3)')
    else:
        missing.append('Research interests (3 to 5 tags)')

    # 7. Contact / Network (10)
    if (user.linkedin_url and len(user.linkedin_url.strip()) >= 8) or (user.phone and len(user.phone.strip()) >= 6):
        score += 10
    else:
        missing.append('LinkedIn profile or Phone number')

    is_complete = (
        score >= 85
        and len(tags) >= 3
        and len(bio_clean) >= 20
        and bool(user.first_name)
        and bool(user.affiliation)
    )

    return score, is_complete, missing


class LoginRateThrottle(AnonRateThrottle):
    rate = '300/minute'


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([LoginRateThrottle])
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
    score, is_complete, missing = calculate_profile_completeness(request.user)
    user_data = UserSerializer(request.user, context={'request': request}).data
    user_data['profile_score'] = score
    user_data['profile_missing'] = missing
    return Response({
        'success': True,
        'user': user_data,
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
    if hasattr(user, 'staff_profile') and user.staff_profile:
        sp = user.staff_profile
        sp.linkedin_url = request.data.get('linkedin_url', sp.linkedin_url)
        sp.profile_url = request.data.get('profile_url', sp.profile_url)
        sp.scholar_url = request.data.get('scholar_url', sp.scholar_url)
        sp.save()

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

    # Sanitize input fields
    mutable_data = request.data.copy()
    for field in ['first_name', 'last_name', 'affiliation', 'bio', 'research_interests', 'designation']:
        if field in mutable_data:
            mutable_data[field] = sanitize_input(mutable_data[field])

    # Enforce research interests bounds if provided
    raw_ri = mutable_data.get('research_interests')
    if raw_ri is not None:
        tags = [t.strip() for t in raw_ri.split(',') if t.strip()]
        if len(tags) > 5:
            return Response({
                'success': False,
                'message': 'Maximum 5 research interests allowed.'
            }, status=status.HTTP_400_BAD_REQUEST)

    serializer = UserSerializer(user, data=mutable_data, partial=True, context={'request': request})
    serializer.is_valid(raise_exception=True)
    serializer.save()

    user.refresh_from_db()

    score, is_now_complete, missing = calculate_profile_completeness(user)
    points_awarded = 0

    if is_now_complete and not was_complete:
        user.profile_complete = True
        user.save(update_fields=['profile_complete'])
        try:
            from apps.leaderboard.utils import award_points
            from apps.leaderboard.models import PointAction, PointEntry
            if not PointEntry.objects.filter(user=user, action=PointAction.PROFILE_COMPLETION).exists():
                award_points(user, PointAction.PROFILE_COMPLETION, 'Profile completed (100%)')
                points_awarded = 50
        except Exception:
            pass
    elif not is_now_complete and was_complete:
        user.profile_complete = False
        user.save(update_fields=['profile_complete'])

    user_data = UserSerializer(user, context={'request': request}).data
    user_data['profile_score'] = score
    user_data['profile_missing'] = missing

    response_data = {
        'success': True,
        'message': 'Profile updated successfully.',
        'user': user_data,
        'profile_score': score,
        'profile_missing': missing,
    }

    if points_awarded > 0:
        response_data['points_awarded'] = points_awarded
        response_data['points_message'] = f'Profile complete! +{points_awarded} points added to leaderboard.'

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


ADMIN_ROLES = ('super_admin', 'mgmt_admin', 'team_head', 'staff')


def _is_admin(user):
    return hasattr(user, 'role') and user.role in ADMIN_ROLES


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_list_view(request):
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
        try:
            from apps.notifications.models import Notification as Notif
            from apps.notifications import fcm
            notif = Notif.objects.create(
                title='Warning from Admin',
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
            pass
        return Response({'success': True, 'action': 'warned', 'note': note})

    elif action == 'suspend':
        reason = note or 'Account suspended by admin.'
        target.is_active        = False
        target.suspended_reason = reason
        target.save(update_fields=['is_active', 'suspended_reason'])
        try:
            from apps.notifications.models import DeviceToken
            DeviceToken.objects.filter(user=target).update(is_active=False)
        except Exception:
            pass
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
            pass
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

    reg_id = (request.data.get('registration_id') or '').strip() or None
    if reg_id and User.objects.filter(registration_id=reg_id).exists():
        return Response({'error': f'Registration ID {reg_id} already exists.'}, status=400)

    if not reg_id:
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

    try:
        from apps.leaderboard.utils import award_points
        from apps.leaderboard.models import PointAction
        award_points(user, PointAction.SIGNUP, 'Welcome to ETD 2026')
    except Exception:
        pass

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


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def discover_view(request):
    from apps.checkins.models import CheckIn

    me = request.user
    my_tags = {t.strip().lower() for t in (me.research_interests or '').split(',') if t.strip()}

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

    cloud = {}
    matches = []

    for u in qs:
        their_tags = {t.strip().lower() for t in (u.research_interests or '').split(',') if t.strip()}

        for tag in their_tags:
            cloud[tag] = cloud.get(tag, 0) + 1

        if not their_tags:
            continue

        common = sorted(my_tags & their_tags)
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
    from django.db.models import Sum, Q
    from apps.leaderboard.models import PointEntry, UserPoints, PointAction
    from apps.photos.models import Photo
    from apps.polls.models import Vote
    from apps.polls.ideathon_models import IdeathonMember
    from apps.schedule.models import SessionBookmark
    from apps.chat.models import ConnectionRequest

    user = request.user

    day_param = request.GET.get('day')
    if day_param and day_param in ('1', '2', '3'):
        day = int(day_param)
    else:
        from datetime import date
        DAY_MAP = {
            date(2026, 10, 23): 1,
            date(2026, 10, 24): 2,
            date(2026, 10, 25): 3,
        }
        today = timezone.localdate()
        day = DAY_MAP.get(today, 1)

    import datetime as dt
    DAY_DATES = {1: dt.date(2026, 10, 23), 2: dt.date(2026, 10, 24), 3: dt.date(2026, 10, 25)}
    day_date  = DAY_DATES.get(day, dt.date(2026, 10, 23))
    ist_offset = dt.timezone(dt.timedelta(hours=5, minutes=30))
    day_start = dt.datetime(day_date.year, day_date.month, day_date.day, 0, 0, 0, tzinfo=ist_offset)
    day_end   = day_start + dt.timedelta(days=1)

    # 1. Total Points & Rank
    try:
        up = UserPoints.objects.get(user=user)
        total_points = up.total_points
        rank = up.rank
    except UserPoints.DoesNotExist:
        total_agg = PointEntry.objects.filter(user=user).aggregate(total=Sum('points'))
        total_points = total_agg['total'] or 0
        rank = None

    if rank is None and total_points > 0:
        higher_count = UserPoints.objects.filter(total_points__gt=total_points).count()
        rank = higher_count + 1

    # 2. Points for day
    entries_today = PointEntry.objects.filter(
        user=user,
        created_at__gte=day_start,
        created_at__lt=day_end,
    )
    points_today = sum(e.points for e in entries_today)

    # Fallback in development / non-conference dates
    if points_today == 0 and total_points > 0:
        today_local = timezone.localdate()
        today_start = dt.datetime(today_local.year, today_local.month, today_local.day, 0, 0, 0, tzinfo=ist_offset)
        real_day_pts = PointEntry.objects.filter(user=user, created_at__gte=today_start).aggregate(s=Sum('points'))['s']
        points_today = real_day_pts if real_day_pts is not None else total_points

    # 3. Connections made
    try:
        connections_count = ConnectionRequest.objects.filter(
            Q(from_user=user) | Q(to_user=user),
            status='accepted'
        ).count()
    except Exception:
        connections_count = PointEntry.objects.filter(user=user, action=PointAction.NETWORKING).count()

    # 4. Bookmarks for this day
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
            'room': s.room or '',
        })

    # 5. Photos & Polls
    photos_count = Photo.objects.filter(uploader=user).count()
    polls_count  = Vote.objects.filter(user=user).count()

    # 6. Team
    team_name = None
    try:
        m = IdeathonMember.objects.select_related('team').get(user=user)
        team_name = m.team.name
    except IdeathonMember.DoesNotExist:
        pass

    # 7. Highlight Message
    if rank and rank <= 3:
        highlight = f"Top 3 Leaderboard standing at ETD 2026!"
    elif rank and rank <= 10:
        highlight = f"Top 10 rank (#{rank}) — fantastic participation!"
    elif connections_count >= 5:
        highlight = f"Super networker with {connections_count} connections!"
    elif total_points >= 100:
        highlight = f"Power contributor with {total_points} total points!"
    elif bookmarked:
        highlight = f"You have {len(bookmarked)} saved session{'s' if len(bookmarked) != 1 else ''} for Day {day}."
    else:
        highlight = "Great to have you at ETD 2026! Discover talks & connect with peers."

    return Response({
        'day': day,
        'points_earned_today': points_today,
        'total_points': total_points,
        'rank': rank,
        'sessions_bookmarked': bookmarked,
        'sessions_bookmarked_count': len(bookmarked),
        'photos_uploaded': photos_count,
        'polls_voted': polls_count,
        'connections_made': connections_count,
        'team': team_name,
        'highlight': highlight,
    })


# ─── Staff & RBAC API Views ──────────────────────────────────────────

from .models import StaffProfile, StaffPermission
from .serializers import StaffDirectorySerializer, StaffPermissionMatrixSerializer
from .permissions_helper import ALL_MODULE_KEYS, get_user_permissions, user_has_module_access

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def staff_directory_view(request):
    profiles = StaffProfile.objects.filter(is_public=True).select_related('user').order_by('order', 'id')
    serializer = StaffDirectorySerializer(profiles, many=True, context={'request': request})
    return Response({
        'success': True,
        'count': len(serializer.data),
        'staff': serializer.data
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def staff_detail_view(request, pk):
    try:
        profile = StaffProfile.objects.select_related('user').get(user__id=pk)
    except StaffProfile.DoesNotExist:
        return Response({'success': False, 'message': 'Staff member not found.'}, status=status.HTTP_404_NOT_FOUND)

    serializer = StaffDirectorySerializer(profile, context={'request': request})
    return Response({'success': True, 'staff': serializer.data})


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def admin_staff_permissions_view(request):
    if request.user.role not in ['super_admin', 'mgmt_admin'] and not user_has_module_access(request.user, 'users_manage'):
        return Response({'success': False, 'message': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        staff_users = User.objects.filter(
            role__in=['super_admin', 'mgmt_admin', 'team_head', 'staff']
        ).select_related('staff_profile').order_by('first_name')

        serializer = StaffPermissionMatrixSerializer(staff_users, many=True)
        return Response({
            'success': True,
            'modules': [{'key': k, 'label': l} for k, l in StaffPermission.MODULE_CHOICES],
            'users': serializer.data
        })

    elif request.method == 'POST':
        user_id = request.data.get('user_id')
        modules = request.data.get('modules', [])

        if not user_id:
            return Response({'success': False, 'message': 'user_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            target_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'success': False, 'message': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        StaffPermission.objects.filter(user=target_user).delete()

        created = []
        for m in modules:
            if m in ALL_MODULE_KEYS:
                StaffPermission.objects.create(
                    user=target_user,
                    module=m,
                    granted_by=request.user
                )
                created.append(m)

        return Response({
            'success': True,
            'message': f"Updated permissions for {target_user.get_full_name()}.",
            'assigned_modules': created
        })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_staff_create_view(request):
    if request.user.role not in ['super_admin', 'mgmt_admin']:
        return Response({'success': False, 'message': 'Permission denied.'}, status=403)

    email = request.data.get('email', '').strip().lower()
    first_name = request.data.get('first_name', '').strip()
    last_name = request.data.get('last_name', '').strip()
    role = request.data.get('role', 'staff')
    password = request.data.get('password', 'Staff@123')
    tier = request.data.get('tier', 'staff')
    designation = request.data.get('designation', '')
    department = request.data.get('department', '')
    phone = request.data.get('phone', '')

    if not email or not first_name:
        return Response({'success': False, 'message': 'Email and first name required.'}, status=400)

    if User.objects.filter(email=email).exists():
        return Response({'success': False, 'message': 'Email already exists.'}, status=400)

    user = User.objects.create_user(
        email=email,
        password=password,
        first_name=first_name,
        last_name=last_name,
        role=role,
    )

    profile = StaffProfile.objects.create(
        user=user,
        tier=tier,
        designation=designation,
        department=department,
        phone=phone,
        order=StaffProfile.objects.count() + 1,
    )

    if 'photo' in request.FILES:
        profile.photo = request.FILES['photo']
        profile.save()

    return Response({
        'success': True,
        'message': f'Staff member {first_name} {last_name} created.',
        'user_id': str(user.id),
    }, status=201)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_staff_edit_view(request, pk):
    if request.user.role not in ['super_admin', 'mgmt_admin']:
        return Response({'success': False, 'message': 'Permission denied.'}, status=403)

    try:
        profile = StaffProfile.objects.select_related('user').get(user__id=pk)
    except StaffProfile.DoesNotExist:
        return Response({'success': False, 'message': 'Staff not found.'}, status=404)

    user = profile.user
    user.first_name = request.data.get('first_name', user.first_name)
    user.last_name = request.data.get('last_name', user.last_name)
    user.role = request.data.get('role', user.role)
    if request.data.get('password'):
        user.set_password(request.data['password'])
    user.save()

    profile.tier = request.data.get('tier', profile.tier)
    profile.designation = request.data.get('designation', profile.designation)
    profile.department = request.data.get('department', profile.department)
    profile.phone = request.data.get('phone', profile.phone)
    profile.linkedin_url = request.data.get('linkedin_url', profile.linkedin_url)
    profile.profile_url = request.data.get('profile_url', profile.profile_url)
    profile.scholar_url = request.data.get('scholar_url', profile.scholar_url)
    if 'photo' in request.FILES:
        profile.photo = request.FILES['photo']
    profile.save()

    return Response({'success': True, 'message': 'Staff profile updated.'})


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def admin_staff_delete_view(request, pk):
    if request.user.role not in ['super_admin', 'mgmt_admin']:
        return Response({'success': False, 'message': 'Permission denied.'}, status=403)

    try:
        profile = StaffProfile.objects.select_related('user').get(user__id=pk)
    except StaffProfile.DoesNotExist:
        return Response({'success': False, 'message': 'Staff not found.'}, status=404)

    name = profile.user.get_full_name()
    profile.user.delete()

    return Response({'success': True, 'message': f'{name} removed.'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def acknowledge_warning_view(request):
    from django.utils import timezone
    user = request.user
    if not user.warning_note:
        return Response({'success': False, 'message': 'No warning note active.'}, status=400)

    response_text = request.data.get('response', '').strip()

    user.warning_acknowledged = True
    user.warning_acknowledged_at = timezone.now()
    user.warning_response = response_text
    user.save(update_fields=['warning_acknowledged', 'warning_acknowledged_at', 'warning_response'])

    return Response({
        'success': True,
        'message': 'Warning acknowledged successfully.',
        'user': UserSerializer(user, context={'request': request}).data,
    })
