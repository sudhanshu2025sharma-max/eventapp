from django.db import IntegrityError, models
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from .ideathon_models import (
    IdeathonConfig, IdeathonTeam, IdeathonMember,
    IdeathonInvite, IdeathonInterest, AVATAR_CHOICES
)
from apps.checkins.models import CheckIn
from apps.accounts.models import User


def _user_detail(user, request=None):
    photo_url = None
    if getattr(user, 'profile_photo', None):
        try:
            photo_url = request.build_absolute_uri(user.profile_photo.url) if request else user.profile_photo.url
        except Exception:
            photo_url = user.profile_photo.url

    return {
        "id": str(user.id),
        "name": user.get_full_name() or user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "affiliation": getattr(user, 'affiliation', '') or '',
        "designation": getattr(user, 'designation', '') or '',
        "photo": photo_url,
        "profile_photo_url": photo_url,
    }


def _team_payload(team, user=None):
    members = []
    for m in team.members.select_related('user').all():
        members.append({
            'user_id':   str(m.user.id),
            'name':      m.user.get_full_name() or m.user.email.split('@')[0],
            'is_leader': m.user_id == team.leader_id,
        })
    is_my_team = bool(user and any(m['user_id'] == str(user.id) for m in members))
    return {
        'id':            str(team.id),
        'name':          team.name,
        'avatar':        team.avatar,
        'project_title': team.project_title,
        'project_desc':  team.project_desc,
        'leader_id':     str(team.leader_id),
        'member_count':  len(members),
        'members':       members,
        'is_my_team':    is_my_team,
    }


def _notify_invite(invitee, team, invited_by):
    """Push notification to invitee."""
    try:
        from apps.notifications.models import DeviceToken
        from apps.notifications.fcm import send_to_tokens
        tokens = list(DeviceToken.objects.filter(
            user=invitee, is_active=True
        ).values_list('token', flat=True))
        if tokens:
            send_to_tokens(
                tokens,
                title=f'🏆 Ideathon Team Invite',
                body=f'{invited_by.get_full_name()} invited you to join "{team.name}"',
                data={'type': 'ideathon_invite', 'team_id': str(team.id)},
            )
    except Exception:
        pass


# ── Public / Participant ──────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([AllowAny])
def ideathon_info(request):
    cfg = IdeathonConfig.get()

    from django.utils import timezone
    if cfg.registration_open and cfg.reg_ends_at and timezone.now() > cfg.reg_ends_at:
        cfg.registration_open = False
        cfg.save(update_fields=['registration_open'])

    teams = IdeathonTeam.objects.prefetch_related('members__user').all()

    my_team = None
    pending_invites = []
    pending_join_requests = []
    my_sent_join_requests = []
    is_interested = False

    if request.user.is_authenticated:
        is_interested = IdeathonInterest.objects.filter(user=request.user).exists()
        mem = IdeathonMember.objects.filter(user=request.user).select_related('team').first()
        if mem:
            my_team = _team_payload(mem.team, request.user)
            if not is_interested:
                IdeathonInterest.objects.get_or_create(user=request.user)
                is_interested = True

        # Pending Invites sent to me
        invites = IdeathonInvite.objects.filter(
            invitee=request.user, status=IdeathonInvite.Status.PENDING
        ).select_related('team', 'invited_by')
        for inv in invites:
            pending_invites.append({
                'invite_id':   str(inv.id),
                'team_id':     str(inv.team.id),
                'team_name':   inv.team.name,
                'team_avatar': inv.team.avatar,
                'invited_by':  inv.invited_by.get_full_name() or inv.invited_by.email,
                'created_at':  inv.created_at.isoformat(),
            })

        # Pending Join Requests sent to my team (if I am the leader)
        if my_team and str(my_team['leader_id']) == str(request.user.id):
            requests_to_my_team = IdeathonJoinRequest.objects.filter(
                team_id=my_team['id'], status=IdeathonJoinRequest.Status.PENDING
            ).select_related('user')
            for req in requests_to_my_team:
                pending_join_requests.append({
                    'request_id':  str(req.id),
                    'user_id':     str(req.user.id),
                    'user_name':   req.user.get_full_name() or req.user.email,
                    'user_email':  req.user.email,
                    'affiliation': getattr(req.user, 'affiliation', '') or '',
                    'created_at':  req.created_at.isoformat(),
                })

        # Sent requests (teams I requested to join)
        my_requests = IdeathonJoinRequest.objects.filter(
            user=request.user, status=IdeathonJoinRequest.Status.PENDING
        ).values_list('team_id', flat=True)
        my_sent_join_requests = [str(tid) for tid in my_requests]

    interested_count = IdeathonInterest.objects.count()

    return Response({
        'registration_open': cfg.is_open,
        'reg_starts_at':     cfg.reg_starts_at.isoformat() if cfg.reg_starts_at else None,
        'reg_ends_at':       cfg.reg_ends_at.isoformat() if cfg.reg_ends_at else None,
        'min_team_size':     cfg.min_team_size or 3,
        'max_team_size':     cfg.max_team_size or 5,
        'description':       cfg.description,
        'teams':             [_team_payload(t, request.user) for t in teams],
        'my_team':           my_team,
        'pending_invites':   pending_invites,
        'pending_join_requests': pending_join_requests,
        'my_sent_join_requests': my_sent_join_requests,
        'is_interested':     is_interested,
        'interested_count':  interested_count,
        'total_teams':       teams.count(),
        'avatar_choices':    [{'value': v, 'label': l} for v, l in AVATAR_CHOICES],
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def toggle_interest(request):
    """Declare or withdraw interest in participating in Ideathon."""
    interest = IdeathonInterest.objects.filter(user=request.user).first()
    if interest:
        # Check if already in a team
        if IdeathonMember.objects.filter(user=request.user).exists():
            return Response({
                'success': False,
                'error': 'You are currently in a team. Leave your team first before withdrawing interest.',
                'is_interested': True
            }, status=400)
        interest.delete()
        is_interested = False
        message = 'You have withdrawn your interest in Ideathon.'
    else:
        IdeathonInterest.objects.create(user=request.user)
        is_interested = True
        message = 'You are now marked as interested in Ideathon! Teammates can now find and invite you.'

    return Response({
        'success': True,
        'is_interested': is_interested,
        'interested_count': IdeathonInterest.objects.count(),
        'message': message,
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def interested_participants(request):
    """
    List all participants who expressed interest in Ideathon.
    Includes search parameter: ?search=
    """
    search = (request.GET.get('search') or '').strip()

    interested_user_ids = list(IdeathonInterest.objects.values_list('user_id', flat=True))
    users = User.objects.filter(id__in=interested_user_ids, is_active=True)

    if search:
        users = users.filter(
            models.Q(first_name__icontains=search) |
            models.Q(last_name__icontains=search) |
            models.Q(affiliation__icontains=search) |
            models.Q(email__icontains=search)
        )

    # Fetch memberships to annotate each user's team status
    memberships = {
        str(m.user_id): {'team_id': str(m.team.id), 'team_name': m.team.name, 'avatar': m.team.avatar}
        for m in IdeathonMember.objects.filter(user_id__in=interested_user_ids).select_related('team')
    }

    result = []
    for u in users:
        u_dict = _user_detail(u, request)
        team_info = memberships.get(str(u.id))
        u_dict['has_team'] = bool(team_info)
        u_dict['team'] = team_info
        result.append(u_dict)

    return Response({
        'success': True,
        'count': len(result),
        'participants': result,
        'users': result,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def check_team_name(request):
    name = request.query_params.get('name', '').strip()
    if not name:
        return Response({'available': False, 'error': 'Name is required.'})
    exists = IdeathonTeam.objects.filter(name__iexact=name).exists()
    return Response({'available': not exists, 'name': name})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_team(request):
    cfg = IdeathonConfig.get()
    if not cfg.is_open:
        return Response({'error': 'Team registration is not open right now.'}, status=400)

    if IdeathonMember.objects.filter(user=request.user).exists():
        return Response({'error': 'You are already in a team. Leave first.'}, status=400)

    name   = (request.data.get('name') or '').strip()
    avatar = (request.data.get('avatar') or 'rocket').strip()

    if not name:
        return Response({'error': 'Team name is required.'}, status=400)
    if len(name) > 200:
        return Response({'error': 'Team name too long (max 200 chars).'}, status=400)
    if IdeathonTeam.objects.filter(name__iexact=name).exists():
        return Response({'error': f'Team name "{name}" is already taken. Choose another.'}, status=400)

    valid_avatars = [v for v, _ in AVATAR_CHOICES]
    if avatar not in valid_avatars:
        avatar = 'rocket'

    try:
        team = IdeathonTeam.objects.create(
            name=name,
            avatar=avatar,
            leader=request.user,
            project_title=(request.data.get('project_title') or '').strip(),
            project_desc=(request.data.get('project_desc') or '').strip(),
        )
        IdeathonMember.objects.create(team=team, user=request.user)
        # Auto-mark creator as interested
        IdeathonInterest.objects.get_or_create(user=request.user)
    except IntegrityError:
        return Response({'error': f'Team name "{name}" is already taken.'}, status=400)

    return Response({
        'success': True,
        'message': f'Team "{name}" created! Invite interested teammates.',
        'team':    _team_payload(team, request.user),
    }, status=201)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def join_team(request, pk):
    cfg = IdeathonConfig.get()
    if not cfg.is_open:
        return Response({'error': 'Team registration is not open right now.'}, status=400)
    if IdeathonMember.objects.filter(user=request.user).exists():
        return Response({'error': 'You are already in a team. Leave first to join another.'}, status=400)
    try:
        team = IdeathonTeam.objects.get(pk=pk)
    except IdeathonTeam.DoesNotExist:
        return Response({'error': 'Team not found.'}, status=404)
    if team.member_count >= (cfg.max_team_size or 5):
        return Response({'error': f'Team is full (max {cfg.max_team_size or 5} members).'}, status=400)

    IdeathonMember.objects.create(team=team, user=request.user)
    IdeathonInterest.objects.get_or_create(user=request.user)
    return Response({
        'success': True,
        'message': f'You joined "{team.name}"!',
        'team': _team_payload(team, request.user),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def invite_member(request, pk):
    cfg = IdeathonConfig.get()
    if not cfg.is_open:
        return Response({'error': 'Team registration is not open.'}, status=400)
    try:
        team = IdeathonTeam.objects.get(pk=pk)
    except IdeathonTeam.DoesNotExist:
        return Response({'error': 'Team not found.'}, status=404)
    if team.leader_id != request.user.id:
        return Response({'error': 'Only the team leader can send invites.'}, status=403)
    if team.member_count >= (cfg.max_team_size or 5):
        return Response({'error': f'Team is full ({cfg.max_team_size or 5} members max).'}, status=400)

    user_id = request.data.get('user_id')
    if not user_id:
        return Response({'error': 'user_id is required.'}, status=400)
    try:
        invitee = User.objects.get(pk=user_id, is_active=True)
    except User.DoesNotExist:
        return Response({'error': 'User not found.'}, status=404)

    if str(invitee.id) == str(request.user.id):
        return Response({'error': 'You cannot invite yourself.'}, status=400)
    if IdeathonMember.objects.filter(user=invitee).exists():
        return Response({'error': f'{invitee.get_full_name()} is already in a team.'}, status=400)

    invite, created = IdeathonInvite.objects.get_or_create(
        team=team, invitee=invitee,
        defaults={'invited_by': request.user, 'status': IdeathonInvite.Status.PENDING},
    )
    if not created:
        if invite.status == IdeathonInvite.Status.PENDING:
            return Response({'error': f'Invite already sent to {invitee.get_full_name()}.'}, status=400)
        invite.status = IdeathonInvite.Status.PENDING
        invite.invited_by = request.user
        invite.save(update_fields=['status', 'invited_by', 'updated_at'])

    _notify_invite(invitee, team, request.user)

    return Response({
        'success': True,
        'message': f'Invite sent to {invitee.get_full_name()}. They must accept to join.',
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def respond_invite(request, invite_id):
    try:
        invite = IdeathonInvite.objects.select_related('team', 'invited_by').get(
            pk=invite_id, invitee=request.user, status=IdeathonInvite.Status.PENDING
        )
    except IdeathonInvite.DoesNotExist:
        return Response({'error': 'Invite not found or already responded.'}, status=404)

    action = request.data.get('action', '').strip()
    if action not in ('accept', 'decline'):
        return Response({'error': 'action must be accept or decline.'}, status=400)

    cfg = IdeathonConfig.get()

    if action == 'accept':
        if not cfg.is_open:
            return Response({'error': 'Team registration is closed.'}, status=400)
        if IdeathonMember.objects.filter(user=request.user).exists():
            return Response({'error': 'You are already in a team.'}, status=400)
        team = invite.team
        if team.member_count >= (cfg.max_team_size or 5):
            invite.status = IdeathonInvite.Status.DECLINED
            invite.save(update_fields=['status', 'updated_at'])
            return Response({'error': 'Team is now full. Invite auto-declined.'}, status=400)

        IdeathonMember.objects.create(team=team, user=request.user)
        IdeathonInterest.objects.get_or_create(user=request.user)
        invite.status = IdeathonInvite.Status.ACCEPTED
        invite.save(update_fields=['status', 'updated_at'])

        try:
            from apps.notifications.models import DeviceToken
            from apps.notifications.fcm import send_to_tokens
            tokens = list(DeviceToken.objects.filter(
                user=invite.invited_by, is_active=True
            ).values_list('token', flat=True))
            if tokens:
                send_to_tokens(
                    tokens,
                    title='✅ Invite Accepted',
                    body=f'{request.user.get_full_name()} joined your team "{team.name}"!',
                    data={'type': 'ideathon_invite_accepted', 'team_id': str(team.id)},
                )
        except Exception:
            pass

        return Response({
            'success': True,
            'message': f'You joined "{team.name}"!',
            'team':    _team_payload(team, request.user),
        })
    else:
        invite.status = IdeathonInvite.Status.DECLINED
        invite.save(update_fields=['status', 'updated_at'])
        return Response({'success': True, 'message': 'Invite declined.'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_leader(request, pk):
    try:
        team = IdeathonTeam.objects.get(pk=pk)
    except IdeathonTeam.DoesNotExist:
        return Response({'error': 'Team not found.'}, status=404)
    if team.leader_id != request.user.id:
        return Response({'error': 'Only the current leader can transfer leadership.'}, status=403)

    user_id = request.data.get('user_id')
    if not user_id:
        return Response({'error': 'user_id is required.'}, status=400)

    if not IdeathonMember.objects.filter(team=team, user_id=user_id).exists():
        return Response({'error': 'That user is not in your team.'}, status=400)

    new_leader = User.objects.get(pk=user_id)
    team.leader = new_leader
    team.save(update_fields=['leader'])

    return Response({
        'success': True,
        'message': f'{new_leader.get_full_name()} is now the team leader.',
        'team':    _team_payload(team, request.user),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def leave_team(request):
    mem = IdeathonMember.objects.filter(user=request.user).select_related('team').first()
    if not mem:
        return Response({'error': 'You are not in any team.'}, status=400)

    team = mem.team
    mem.delete()

    remaining = team.members.select_related('user').order_by('joined_at')
    if not remaining.exists():
        team.delete()
        return Response({'success': True, 'message': 'You left. Team disbanded (no members left).'})

    if team.leader_id == request.user.id:
        new_leader = remaining.first().user
        team.leader = new_leader
        team.save(update_fields=['leader'])

    return Response({'success': True, 'message': f'You left "{team.name}".'})


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_team(request, pk):
    try:
        team = IdeathonTeam.objects.get(pk=pk)
    except IdeathonTeam.DoesNotExist:
        return Response({'error': 'Team not found.'}, status=404)
    if team.leader_id != request.user.id:
        return Response({'error': 'Only the leader can update team details.'}, status=403)

    if 'project_title' in request.data:
        team.project_title = (request.data['project_title'] or '').strip()
    if 'project_desc' in request.data:
        team.project_desc = (request.data['project_desc'] or '').strip()
    if 'avatar' in request.data:
        valid = [v for v, _ in AVATAR_CHOICES]
        if request.data['avatar'] in valid:
            team.avatar = request.data['avatar']
    team.save()

    return Response({'success': True, 'team': _team_payload(team, request.user)})


# ── Admin CRUD ────────────────────────────────────────────────────────────────

def _is_admin(user):
    return getattr(user, 'role', '') in ('super_admin', 'mgmt_admin', 'team_head', 'staff') or user.is_superuser


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_create_team(request):
    if not _is_admin(request.user):
        return Response({'error': 'Admin access required.'}, status=403)

    name = (request.data.get('name') or '').strip()
    avatar = (request.data.get('avatar') or 'rocket').strip()
    project_title = (request.data.get('project_title') or '').strip()
    project_desc = (request.data.get('project_desc') or '').strip()
    leader_id = request.data.get('leader_id')

    if not name:
        return Response({'error': 'Team name is required.'}, status=400)
    if IdeathonTeam.objects.filter(name__iexact=name).exists():
        return Response({'error': f'Team name "{name}" is already taken.'}, status=400)

    valid_avatars = [v for v, _ in AVATAR_CHOICES]
    if avatar not in valid_avatars:
        avatar = 'rocket'

    # Resolve leader
    leader = None
    if leader_id:
        try:
            leader = User.objects.get(pk=leader_id, is_active=True)
        except User.DoesNotExist:
            return Response({'error': 'Leader user not found.'}, status=404)
        if IdeathonMember.objects.filter(user=leader).exists():
            return Response({'error': f'{leader.get_full_name()} is already in a team.'}, status=400)
    else:
        return Response({'error': 'leader_id is required.'}, status=400)

    team = IdeathonTeam.objects.create(
        name=name, avatar=avatar, leader=leader,
        project_title=project_title, project_desc=project_desc,
    )
    IdeathonMember.objects.create(team=team, user=leader)
    IdeathonInterest.objects.get_or_create(user=leader)

    # Add additional members if provided
    member_ids = request.data.get('member_ids', [])
    for mid in member_ids:
        try:
            u = User.objects.get(pk=mid, is_active=True)
            if not IdeathonMember.objects.filter(user=u).exists():
                IdeathonMember.objects.create(team=team, user=u)
                IdeathonInterest.objects.get_or_create(user=u)
        except User.DoesNotExist:
            pass

    return Response({
        'success': True,
        'message': f'Team "{name}" created by admin.',
        'team': _team_payload(team, request.user),
    }, status=201)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def admin_team_detail(request, pk):
    if not _is_admin(request.user):
        return Response({'error': 'Admin access required.'}, status=403)
    try:
        team = IdeathonTeam.objects.get(pk=pk)
    except IdeathonTeam.DoesNotExist:
        return Response({'error': 'Team not found.'}, status=404)

    if request.method == 'DELETE':
        team_name = team.name
        team.delete()
        return Response({'success': True, 'message': f'Team "{team_name}" disbanded.'})

    # PATCH
    if 'name' in request.data:
        new_name = (request.data['name'] or '').strip()
        if not new_name:
            return Response({'error': 'Team name cannot be empty.'}, status=400)
        if IdeathonTeam.objects.filter(name__iexact=new_name).exclude(pk=team.pk).exists():
            return Response({'error': f'Team name "{new_name}" is already taken.'}, status=400)
        team.name = new_name
    if 'project_title' in request.data:
        team.project_title = (request.data['project_title'] or '').strip()
    if 'project_desc' in request.data:
        team.project_desc = (request.data['project_desc'] or '').strip()
    if 'avatar' in request.data:
        valid = [v for v, _ in AVATAR_CHOICES]
        if request.data['avatar'] in valid:
            team.avatar = request.data['avatar']
    team.save()
    return Response({'success': True, 'message': 'Team updated.', 'team': _team_payload(team, request.user)})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_add_member(request, pk):
    if not _is_admin(request.user):
        return Response({'error': 'Admin access required.'}, status=403)
    try:
        team = IdeathonTeam.objects.get(pk=pk)
    except IdeathonTeam.DoesNotExist:
        return Response({'error': 'Team not found.'}, status=404)

    user_id = request.data.get('user_id')
    if not user_id:
        return Response({'error': 'user_id is required.'}, status=400)
    try:
        user = User.objects.get(pk=user_id, is_active=True)
    except User.DoesNotExist:
        return Response({'error': 'User not found.'}, status=404)

    if IdeathonMember.objects.filter(user=user).exists():
        return Response({'error': f'{user.get_full_name()} is already in a team.'}, status=400)

    cfg = IdeathonConfig.get()
    if team.member_count >= (cfg.max_team_size or 5):
        return Response({'error': f'Team is full (max {cfg.max_team_size or 5}).'}, status=400)

    IdeathonMember.objects.create(team=team, user=user)
    IdeathonInterest.objects.get_or_create(user=user)
    return Response({'success': True, 'message': f'{user.get_full_name()} added to "{team.name}".', 'team': _team_payload(team, request.user)})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_remove_member(request, pk):
    if not _is_admin(request.user):
        return Response({'error': 'Admin access required.'}, status=403)
    try:
        team = IdeathonTeam.objects.get(pk=pk)
    except IdeathonTeam.DoesNotExist:
        return Response({'error': 'Team not found.'}, status=404)

    user_id = request.data.get('user_id')
    if not user_id:
        return Response({'error': 'user_id is required.'}, status=400)

    mem = IdeathonMember.objects.filter(team=team, user_id=user_id).first()
    if not mem:
        return Response({'error': 'User is not in this team.'}, status=400)

    was_leader = (team.leader_id == mem.user_id)
    user_name = mem.user.get_full_name() or mem.user.email
    mem.delete()

    remaining = team.members.select_related('user').order_by('joined_at')
    if not remaining.exists():
        team.delete()
        return Response({'success': True, 'message': f'{user_name} removed. Team disbanded (empty).'})

    if was_leader:
        new_leader = remaining.first().user
        team.leader = new_leader
        team.save(update_fields=['leader'])

    return Response({'success': True, 'message': f'{user_name} removed from "{team.name}".', 'team': _team_payload(team, request.user)})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_change_leader(request, pk):
    if not _is_admin(request.user):
        return Response({'error': 'Admin access required.'}, status=403)
    try:
        team = IdeathonTeam.objects.get(pk=pk)
    except IdeathonTeam.DoesNotExist:
        return Response({'error': 'Team not found.'}, status=404)

    user_id = request.data.get('user_id')
    if not user_id:
        return Response({'error': 'user_id is required.'}, status=400)

    if not IdeathonMember.objects.filter(team=team, user_id=user_id).exists():
        return Response({'error': 'That user is not in this team.'}, status=400)

    new_leader = User.objects.get(pk=user_id)
    team.leader = new_leader
    team.save(update_fields=['leader'])
    return Response({'success': True, 'message': f'{new_leader.get_full_name()} is now leader of "{team.name}".', 'team': _team_payload(team, request.user)})

# ── Join Requests ─────────────────────────────────────────────────────────────

from .ideathon_models import IdeathonJoinRequest

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def request_to_join(request, pk):
    """Participant asks to join an existing team."""
    cfg = IdeathonConfig.get()
    if not cfg.is_open:
        return Response({'error': 'Team registration is closed.'}, status=400)

    if IdeathonMember.objects.filter(user=request.user).exists():
        return Response({'error': 'You are already in a team.'}, status=400)

    try:
        team = IdeathonTeam.objects.get(pk=pk)
    except IdeathonTeam.DoesNotExist:
        return Response({'error': 'Team not found.'}, status=404)

    if team.member_count >= (cfg.max_team_size or 5):
        return Response({'error': 'This team is already full.'}, status=400)

    req, created = IdeathonJoinRequest.objects.get_or_create(
        team=team, user=request.user,
        defaults={'status': IdeathonJoinRequest.Status.PENDING}
    )

    if not created:
        if req.status == IdeathonJoinRequest.Status.PENDING:
            return Response({'error': 'You have already requested to join this team.'}, status=400)
        req.status = IdeathonJoinRequest.Status.PENDING
        req.save(update_fields=['status', 'updated_at'])

    # Send a push notification to the team leader
    try:
        from apps.notifications.models import DeviceToken
        from apps.notifications.fcm import send_to_tokens
        tokens = list(DeviceToken.objects.filter(
            user=team.leader, is_active=True
        ).values_list('token', flat=True))
        if tokens:
            send_to_tokens(
                tokens,
                title='⚡ Join Request Received',
                body=f'{request.user.get_full_name()} wants to join your team "{team.name}".',
                data={'type': 'ideathon_join_request', 'team_id': str(team.id)},
            )
    except Exception:
        pass

    return Response({
        'success': True,
        'message': f'Your request to join "{team.name}" has been submitted to the team leader!'
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def respond_join_request(request, request_id):
    """Team leader accepts or declines a request to join."""
    try:
        join_req = IdeathonJoinRequest.objects.select_related('team', 'user').get(
            pk=request_id, status=IdeathonJoinRequest.Status.PENDING
        )
    except IdeathonJoinRequest.DoesNotExist:
        return Response({'error': 'Join request not found or already processed.'}, status=404)

    team = join_req.team
    if team.leader_id != request.user.id:
        return Response({'error': 'Only the team leader can respond to join requests.'}, status=403)

    action = request.data.get('action', '').strip()
    if action not in ('accept', 'decline'):
        return Response({'error': 'Action must be accept or decline.'}, status=400)

    cfg = IdeathonConfig.get()

    if action == 'accept':
        if not cfg.is_open:
            return Response({'error': 'Team registration is closed.'}, status=400)
        if IdeathonMember.objects.filter(user=join_req.user).exists():
            join_req.status = IdeathonJoinRequest.Status.DECLINED
            join_req.save(update_fields=['status', 'updated_at'])
            return Response({'error': f'{join_req.user.get_full_name()} is already in a team now.'}, status=400)

        if team.member_count >= (cfg.max_team_size or 5):
            return Response({'error': 'Your team is full.'}, status=400)

        # Form membership
        IdeathonMember.objects.create(team=team, user=join_req.user)
        IdeathonInterest.objects.get_or_create(user=join_req.user)

        join_req.status = IdeathonJoinRequest.Status.ACCEPTED
        join_req.save(update_fields=['status', 'updated_at'])

        # Decline other pending requests for this accepted user
        IdeathonJoinRequest.objects.filter(
            user=join_req.user, status=IdeathonJoinRequest.Status.PENDING
        ).update(status=IdeathonJoinRequest.Status.DECLINED)

        # Notify the applicant
        try:
            from apps.notifications.models import DeviceToken
            from apps.notifications.fcm import send_to_tokens
            tokens = list(DeviceToken.objects.filter(
                user=join_req.user, is_active=True
            ).values_list('token', flat=True))
            if tokens:
                send_to_tokens(
                    tokens,
                    title='🎉 Join Request Approved!',
                    body=f'The team leader accepted your request to join "{team.name}"!',
                    data={'type': 'join_request_approved', 'team_id': str(team.id)},
                )
        except Exception:
            pass

        return Response({
            'success': True,
            'message': f'{join_req.user.get_full_name()} joined your team!',
            'team': _team_payload(team, request.user)
        })

    else:
        join_req.status = IdeathonJoinRequest.Status.DECLINED
        join_req.save(update_fields=['status', 'updated_at'])

        # Notify decline
        try:
            from apps.notifications.models import DeviceToken
            from apps.notifications.fcm import send_to_tokens
            tokens = list(DeviceToken.objects.filter(
                user=join_req.user, is_active=True
            ).values_list('token', flat=True))
            if tokens:
                send_to_tokens(
                    tokens,
                    title='❌ Join Request Update',
                    body=f'Your request to join "{team.name}" was declined.',
                    data={'type': 'join_request_declined'},
                )
        except Exception:
            pass

        return Response({'success': True, 'message': 'Request declined.'})

