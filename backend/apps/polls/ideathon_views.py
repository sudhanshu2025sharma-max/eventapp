from django.db import IntegrityError
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from .ideathon_models import IdeathonConfig, IdeathonTeam, IdeathonMember, IdeathonInvite, AVATAR_CHOICES


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

    # Auto-close expired if needed
    from django.utils import timezone
    if cfg.registration_open and cfg.reg_ends_at and timezone.now() > cfg.reg_ends_at:
        cfg.registration_open = False
        cfg.save(update_fields=['registration_open'])

    teams = IdeathonTeam.objects.prefetch_related('members__user').all()

    my_team = None
    pending_invites = []
    if request.user.is_authenticated:
        mem = IdeathonMember.objects.filter(user=request.user).select_related('team').first()
        if mem:
            my_team = _team_payload(mem.team, request.user)
        # Pending invites for this user
        invites = IdeathonInvite.objects.filter(
            invitee=request.user, status=IdeathonInvite.Status.PENDING
        ).select_related('team', 'invited_by')
        for inv in invites:
            pending_invites.append({
                'invite_id':  str(inv.id),
                'team_id':    str(inv.team.id),
                'team_name':  inv.team.name,
                'team_avatar': inv.team.avatar,
                'invited_by': inv.invited_by.get_full_name() or inv.invited_by.email,
                'created_at': inv.created_at.isoformat(),
            })

    return Response({
        'registration_open': cfg.is_open,
        'reg_starts_at':     cfg.reg_starts_at.isoformat() if cfg.reg_starts_at else None,
        'reg_ends_at':       cfg.reg_ends_at.isoformat() if cfg.reg_ends_at else None,
        'min_team_size':     cfg.min_team_size,
        'max_team_size':     cfg.max_team_size,
        'description':       cfg.description,
        'teams':             [_team_payload(t, request.user) for t in teams],
        'my_team':           my_team,
        'pending_invites':   pending_invites,
        'total_teams':       teams.count(),
        'avatar_choices':    [{'value': v, 'label': l} for v, l in AVATAR_CHOICES],
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def check_team_name(request):
    """GET /polls/ideathon/check-name/?name=xxx — returns {available: bool}"""
    name = request.query_params.get('name', '').strip()
    if not name:
        return Response({'available': False, 'error': 'Name is required.'})
    exists = IdeathonTeam.objects.filter(name__iexact=name).exists()
    return Response({'available': not exists, 'name': name})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_team(request):
    """
    Create a new team.
    Body: { name, avatar, project_title, project_desc, leader_user_id (optional) }
    Creator is always a member. Leader defaults to creator but can be any member.
    Initial invited members sent separately via invite endpoint.
    """
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
    except IntegrityError:
        return Response({'error': f'Team name "{name}" is already taken.'}, status=400)

    return Response({
        'success': True,
        'message': f'Team "{name}" created! Invite members by searching checked-in participants.',
        'team':    _team_payload(team, request.user),
    }, status=201)



@api_view(['POST'])
@permission_classes([IsAuthenticated])
def join_team(request, pk):
    """Direct join — only works if registration is open and user has no team."""
    cfg = IdeathonConfig.get()
    if not cfg.is_open:
        return Response({'error': 'Team registration is not open right now.'}, status=400)
    if IdeathonMember.objects.filter(user=request.user).exists():
        return Response({'error': 'You are already in a team. Leave first to join another.'}, status=400)
    try:
        team = IdeathonTeam.objects.get(pk=pk)
    except IdeathonTeam.DoesNotExist:
        return Response({'error': 'Team not found.'}, status=404)
    if team.member_count >= cfg.max_team_size:
        return Response({'error': f'Team is full (max {cfg.max_team_size} members).'}, status=400)
    IdeathonMember.objects.create(team=team, user=request.user)
    return Response({
        'success': True,
        'message': f'You joined "{team.name}"!',
        'team': _team_payload(team, request.user),
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def invite_member(request, pk):
    """
    Leader sends an invite to a checked-in participant.
    Body: { user_id }
    Invitee gets a push notification and must accept.
    """
    cfg = IdeathonConfig.get()
    if not cfg.is_open:
        return Response({'error': 'Team registration is not open.'}, status=400)
    try:
        team = IdeathonTeam.objects.get(pk=pk)
    except IdeathonTeam.DoesNotExist:
        return Response({'error': 'Team not found.'}, status=404)
    if team.leader_id != request.user.id:
        return Response({'error': 'Only the team leader can send invites.'}, status=403)
    if team.member_count >= cfg.max_team_size:
        return Response({'error': f'Team is full ({cfg.max_team_size} members max).'}, status=400)

    from django.contrib.auth import get_user_model
    User = get_user_model()
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

    # Check/create invite
    invite, created = IdeathonInvite.objects.get_or_create(
        team=team, invitee=invitee,
        defaults={'invited_by': request.user, 'status': IdeathonInvite.Status.PENDING},
    )
    if not created:
        if invite.status == IdeathonInvite.Status.PENDING:
            return Response({'error': f'Invite already sent to {invitee.get_full_name()}.'}, status=400)
        # Re-send if previously declined
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
    """
    Invitee accepts or declines.
    Body: { action: 'accept' | 'decline' }
    """
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
        if team.member_count >= cfg.max_team_size:
            invite.status = IdeathonInvite.Status.DECLINED
            invite.save(update_fields=['status', 'updated_at'])
            return Response({'error': 'Team is now full. Invite auto-declined.'}, status=400)

        IdeathonMember.objects.create(team=team, user=request.user)
        invite.status = IdeathonInvite.Status.ACCEPTED
        invite.save(update_fields=['status', 'updated_at'])

        # Notify leader
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
    """
    Leader transfers leadership to another team member.
    Body: { user_id }
    """
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

    from django.contrib.auth import get_user_model
    new_leader = get_user_model().objects.get(pk=user_id)
    team.leader_id = user_id
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
        from .ideathon_models import AVATAR_CHOICES
        valid = [v for v, _ in AVATAR_CHOICES]
        if request.data['avatar'] in valid:
            team.avatar = request.data['avatar']
    team.save()

    return Response({'success': True, 'team': _team_payload(team, request.user)})
