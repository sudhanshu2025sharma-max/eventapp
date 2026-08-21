from django.db import transaction, IntegrityError
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from .models import Poll, PollOption, Vote, PollAuditLog


def _is_admin(user):
    return user.is_authenticated and user.role in ('super_admin', 'mgmt_admin')


def _poll_payload(poll, user=None):
    show_results = (
        poll.result_vis == Poll.ResultVis.LIVE or
        (poll.result_vis == Poll.ResultVis.AFTER and poll.status == Poll.Status.CLOSED)
    )

    user_voted = False
    user_option_ids = []
    if user and user.is_authenticated:
        uv = Vote.objects.filter(poll=poll, user=user).select_related('option')
        user_voted = uv.exists()
        user_option_ids = [str(v.option_id) for v in uv]

    results_map = {}
    if show_results:
        for r in poll.results():
            results_map[r['id']] = r

    opts = []
    for opt in poll.options.all():
        o = {
            'id':            str(opt.id),
            'text':          opt.text,
            'order':         opt.order,
            'team_name':     opt.team_name,
            'team_members':  opt.team_members,
            'project_title': opt.project_title,
            'project_desc':  opt.project_desc,
            'is_selected':   str(opt.id) in user_option_ids,
        }
        if show_results and str(opt.id) in results_map:
            o['votes'] = results_map[str(opt.id)]['votes']
            o['pct']   = results_map[str(opt.id)]['pct']
        opts.append(o)

    seconds_left = None
    if poll.ends_at and poll.status == Poll.Status.LIVE:
        seconds_left = max(0, int((poll.ends_at - timezone.now()).total_seconds()))

    payload = {
        'id':            str(poll.id),
        'title':         poll.title,
        'question':      poll.question,
        'description':   poll.description,
        'poll_type':     poll.poll_type,
        'status':        poll.status,
        'is_ideathon':   poll.is_ideathon,
        'result_vis':    poll.result_vis,
        'show_results':  show_results,
        'starts_at':     poll.starts_at.isoformat() if poll.starts_at else None,
        'ends_at':       poll.ends_at.isoformat() if poll.ends_at else None,
        'seconds_left':  seconds_left,
        'max_choices':   poll.max_choices,
        'total_votes':   poll.total_votes,
        'options':       opts,
        'user_voted':    user_voted,
        'user_option_ids': user_option_ids,
        'award_points':  poll.award_points,
        'session_id':    str(poll.session_id) if poll.session_id else None,
    }

    # Ideathon: tell the client whether this user is a team leader
    if poll.is_ideathon and user and user.is_authenticated:
        try:
            from .ideathon_models import IdeathonMember
            mem = IdeathonMember.objects.filter(user=user).select_related('team').first()
            if mem:
                payload['my_team_name']   = mem.team.name
                payload['is_team_leader'] = (mem.team.leader_id == user.id)
            else:
                payload['my_team_name']   = None
                payload['is_team_leader'] = False
        except Exception:
            pass

    return payload


# ── Public / Participant ──────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([AllowAny])
def poll_list(request):
    # Auto-close expired live polls
    now = timezone.now()
    Poll.objects.filter(status=Poll.Status.LIVE, ends_at__lt=now).update(
        status=Poll.Status.CLOSED
    )
    qs = Poll.objects.exclude(status=Poll.Status.DRAFT).prefetch_related('options')
    return Response({'polls': [_poll_payload(p, request.user) for p in qs], 'count': qs.count()})


@api_view(['GET'])
@permission_classes([AllowAny])
def poll_detail(request, pk):
    try:
        poll = Poll.objects.prefetch_related('options').get(pk=pk)
    except Poll.DoesNotExist:
        return Response({'error': 'Not found'}, status=404)
    if poll.status == Poll.Status.DRAFT and not _is_admin(request.user):
        return Response({'error': 'Not found'}, status=404)
    return Response(_poll_payload(poll, request.user))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def poll_vote(request, pk):
    try:
        poll = Poll.objects.prefetch_related('options').get(pk=pk)
    except Poll.DoesNotExist:
        return Response({'error': 'Poll not found'}, status=404)

    if not poll.is_open:
        return Response({'error': 'This poll is not accepting votes right now.'}, status=400)

    # Ideathon: only team leaders vote, cannot vote for own team
    if poll.is_ideathon:
        from .ideathon_models import IdeathonMember
        mem = IdeathonMember.objects.filter(user=request.user).select_related('team').first()
        if not mem:
            return Response({'error': 'You must be in an Ideathon team to vote.'}, status=400)
        if mem.team.leader_id != request.user.id:
            return Response({
                'error': 'Only team leaders cast the vote for their team.'
            }, status=400)
        # Block voting for own team
        own_team_name = mem.team.name.strip().lower()
        submitted_option_ids = request.data.get('option_ids', [])
        for oid in submitted_option_ids:
            try:
                opt = PollOption.objects.get(pk=oid, poll=poll)
                if opt.team_name and opt.team_name.strip().lower() == own_team_name:
                    return Response({'error': 'You cannot vote for your own team.'}, status=400)
            except PollOption.DoesNotExist:
                pass

    option_ids = request.data.get('option_ids', [])
    if not isinstance(option_ids, list) or not option_ids:
        return Response({'error': 'option_ids must be a non-empty list.'}, status=400)

    if poll.poll_type in (Poll.Type.SINGLE, Poll.Type.YESNO, Poll.Type.RATING):
        if len(option_ids) != 1:
            return Response({'error': 'Exactly one option required.'}, status=400)

    if poll.poll_type == Poll.Type.MULTIPLE and poll.max_choices > 0:
        if len(option_ids) > poll.max_choices:
            return Response({'error': f'Maximum {poll.max_choices} choices allowed.'}, status=400)

    # Validate all options belong to this poll
    valid_ids = {str(o.id) for o in poll.options.all()}
    for oid in option_ids:
        if str(oid) not in valid_ids:
            return Response({'error': f'Invalid option: {oid}'}, status=400)

    if Vote.objects.filter(poll=poll, user=request.user).exists():
        return Response({'error': 'You have already voted in this poll.'}, status=400)

    points_awarded = 0
    try:
        with transaction.atomic():
            Vote.objects.create(
                poll=poll,
                option_id=option_ids[0],
                user=request.user,
            )
    except IntegrityError:
        # DB unique constraint caught a race condition duplicate
        return Response({'error': 'You have already voted in this poll.'}, status=400)

    # Award points AFTER successful vote commit
    # Use get_or_create on a deterministic note to prevent duplicate awards
    # even under concurrent requests
    if poll.award_points:
        try:
            from apps.leaderboard.models import PointAction, PointEntry, POINT_VALUES
            note = f'poll:{pk}'
            # Atomic get_or_create prevents duplicate points under concurrency
            entry, created = PointEntry.objects.get_or_create(
                user=request.user,
                action=PointAction.POLL_VOTE,
                note=note,
                defaults={'points': POINT_VALUES[PointAction.POLL_VOTE]},
            )
            if created:
                # Update UserPoints total
                from apps.leaderboard.models import UserPoints
                pts = POINT_VALUES[PointAction.POLL_VOTE]
                summary, _ = UserPoints.objects.get_or_create(user=request.user)
                # Use F() to avoid race on the total
                from django.db.models import F
                UserPoints.objects.filter(user=request.user).update(
                    total_points=F('total_points') + pts
                )
                points_awarded = pts
        except Exception:
            pass

    poll.refresh_from_db()
    return Response({
        'success':        True,
        'message':        'Vote recorded.',
        'points_awarded': points_awarded,
        'poll':           _poll_payload(poll, request.user),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_vote(request, pk):
    try:
        poll = Poll.objects.get(pk=pk)
    except Poll.DoesNotExist:
        return Response({'error': 'Not found'}, status=404)
    vote = Vote.objects.filter(poll=poll, user=request.user).select_related('option').first()
    if not vote:
        return Response({'voted': False})
    return Response({
        'voted':       True,
        'option_id':   str(vote.option_id),
        'option_text': vote.option.text,
        'voted_at':    vote.created_at.isoformat(),
    })


# ── Admin API ─────────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_poll_list(request):
    if not _is_admin(request.user):
        return Response({'error': 'Forbidden'}, status=403)
    polls = Poll.objects.prefetch_related('options').all()
    return Response({'polls': [_poll_payload(p, request.user) for p in polls]})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_poll_action(request, pk):
    if not _is_admin(request.user):
        return Response({'error': 'Forbidden'}, status=403)
    try:
        poll = Poll.objects.get(pk=pk)
    except Poll.DoesNotExist:
        return Response({'error': 'Not found'}, status=404)

    action = request.data.get('action')
    if action == 'start':
        poll.status = Poll.Status.LIVE
        if not poll.starts_at:
            poll.starts_at = timezone.now()
        poll.save()
        PollAuditLog.objects.create(poll=poll, admin=request.user, action='started')
        _push_poll_live(poll, request)
    elif action == 'close':
        poll.status = Poll.Status.CLOSED
        if not poll.ends_at:
            poll.ends_at = timezone.now()
        poll.save()
        PollAuditLog.objects.create(poll=poll, admin=request.user, action='closed')
    elif action == 'reopen':
        poll.status = Poll.Status.LIVE
        poll.ends_at = None
        poll.save()
        PollAuditLog.objects.create(poll=poll, admin=request.user, action='reopened')
        _push_poll_live(poll, request)
    else:
        return Response({'error': 'action must be start|close|reopen'}, status=400)

    return Response({'success': True, 'status': poll.status})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_poll_results(request, pk):
    if not _is_admin(request.user):
        return Response({'error': 'Forbidden'}, status=403)
    try:
        poll = Poll.objects.prefetch_related('options').get(pk=pk)
    except Poll.DoesNotExist:
        return Response({'error': 'Not found'}, status=404)

    results = poll.results()
    total   = poll.total_votes

    # Who voted and what they chose
    votes = Vote.objects.filter(poll=poll).select_related('user', 'option').order_by('-created_at')
    voters = [{
        'user_id':   str(v.user.id),
        'name':      v.user.get_full_name() or v.user.email,
        'email':     v.user.email,
        'option':    v.option.text,
        'option_id': str(v.option_id),
        'voted_at':  v.created_at.isoformat(),
    } for v in votes]

    # Who hasn't voted — all checked-in participants for normal polls
    # For ideathon: all team leaders
    non_voters = []
    if poll.is_ideathon:
        from .ideathon_models import IdeathonMember
        leader_ids = set(
            IdeathonMember.objects.filter(
                team__leader_id__in=IdeathonMember.objects.values('user_id')
            ).values_list('team__leader_id', flat=True)
        )
        voted_ids = set(v['user_id'] for v in voters)
        from apps.accounts.models import User
        for u in User.objects.filter(id__in=leader_ids - voted_ids):
            non_voters.append({'name': u.get_full_name(), 'email': u.email})
    else:
        from apps.checkins.models import CheckIn
        voted_ids = set(v['user_id'] for v in voters)
        eligible_ids = set(str(uid) for uid in CheckIn.objects.filter(
            checkin_type='conference'
        ).values_list('user_id', flat=True))
        from apps.accounts.models import User
        for u in User.objects.filter(
            id__in=eligible_ids - voted_ids, role='participant'
        ).order_by('first_name')[:100]:
            non_voters.append({'name': u.get_full_name(), 'email': u.email})

    eligible_count = len(voters) + len(non_voters)
    participation_pct = round(len(voters) * 100 / eligible_count, 1) if eligible_count else 0

    return Response({
        'poll':              _poll_payload(poll, request.user),
        'results':           results,
        'total_votes':       total,
        'voters':            voters,
        'non_voters':        non_voters[:50],  # cap at 50 for payload size
        'non_voter_count':   len(non_voters),
        'eligible_count':    eligible_count,
        'participation_pct': participation_pct,
    })


def _push_poll_live(poll, request):
    try:
        from apps.notifications.models import Notification as Notif
        from apps.notifications.fcm import send_to_all
        emoji = '🏆' if poll.is_ideathon else '📊'
        notif = Notif.objects.create(
            title=f'{emoji} Poll is Live — {poll.title}',
            body=poll.question[:120],
            target_type='all', sent_by=request.user, status='pending',
            data={'type': 'poll', 'poll_id': str(poll.id)},
        )
        s, f, _ = send_to_all(notif.title, notif.body, notif.data, notif, request)
        notif.status = 'sent'; notif.sent_count = s; notif.failed_count = f; notif.save()
    except Exception:
        pass


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_poll_create(request):
    """Mobile admin: create a poll (simple — full create on web panel)."""
    if not _is_admin(request.user):
        return Response({'error': 'Forbidden'}, status=403)

    title    = (request.data.get('title') or '').strip()
    question = (request.data.get('question') or '').strip()
    if not title or not question:
        return Response({'error': 'title and question are required.'}, status=400)

    poll_type = request.data.get('poll_type', 'single')
    if poll_type not in ('single', 'multiple', 'yesno', 'rating'):
        poll_type = 'single'

    from django.utils import timezone as tz
    poll = Poll.objects.create(
        title=title,
        question=question,
        description=(request.data.get('description') or '').strip(),
        poll_type=poll_type,
        status=Poll.Status.DRAFT,
        result_vis=request.data.get('result_vis', Poll.ResultVis.AFTER),
        is_ideathon=bool(request.data.get('is_ideathon', False)),
        award_points=bool(request.data.get('award_points', True)),
        created_by=request.user,
    )

    options = request.data.get('options', [])
    for i, opt in enumerate(options):
        text = (opt.get('text') or '').strip()
        if text:
            PollOption.objects.create(poll=poll, text=text, order=i)

    PollAuditLog.objects.create(poll=poll, admin=request.user, action='created via mobile')

    # Auto-start if requested
    if request.data.get('start_now'):
        poll.status = Poll.Status.LIVE
        poll.starts_at = tz.now()
        poll.save()
        PollAuditLog.objects.create(poll=poll, admin=request.user, action='started via mobile')
        _push_poll_live(poll, request)

    return Response({'success': True, 'poll': _poll_payload(poll, request.user)}, status=201)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_ideathon_toggle(request):
    """Mobile admin: toggle ideathon registration open/closed."""
    if not _is_admin(request.user):
        return Response({'error': 'Forbidden'}, status=403)

    from .ideathon_models import IdeathonConfig
    cfg = IdeathonConfig.get()
    cfg.registration_open = not cfg.registration_open
    cfg.updated_by = request.user
    cfg.save()

    if cfg.registration_open:
        try:
            from apps.notifications.models import Notification as Notif
            from apps.notifications.fcm import send_to_all
            notif = Notif.objects.create(
                title='🏆 Ideathon Team Registration is Open!',
                body='Form your teams now in the app. Teams of 2–5 members.',
                target_type='all', sent_by=request.user, status='pending',
                data={'type': 'poll'},
            )
            s, f, _ = send_to_all(notif.title, notif.body, notif.data, notif, request)
            notif.status = 'sent'; notif.sent_count = s; notif.failed_count = f; notif.save()
        except Exception:
            pass

    return Response({
        'success': True,
        'registration_open': cfg.registration_open,
        'message': f'Registration {"opened" if cfg.registration_open else "closed"}.',
    })
