import csv
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.http import HttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from zoneinfo import ZoneInfo

from apps.accounts.admin_views import admin_required
from .models import Poll, PollOption, Vote, PollAuditLog

IST = ZoneInfo("Asia/Kolkata")


def _parse_dt(val):
    if not val:
        return None
    dt = parse_datetime(val)
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=IST)
    return dt.astimezone(timezone.utc)


def _notify_poll_live(poll, request):
    """Send push + in-app notification to ALL users when a poll goes live."""
    try:
        from apps.notifications.models import Notification as Notif
        from apps.notifications.fcm import send_to_all
        emoji = '🏆' if poll.is_ideathon else '📊'
        notif = Notif.objects.create(
            title=f'{emoji} New Poll is Live',
            body=poll.question[:120],
            target_type='all',
            sent_by=request.user,
            status='pending',
            data={'type': 'poll', 'poll_id': str(poll.id)},
        )
        s, f, _ = send_to_all(notif.title, notif.body, notif.data, notif, request)
        notif.status = 'sent'
        notif.sent_count = s
        notif.failed_count = f
        notif.save()
    except Exception:
        pass


# ── Poll List ────────────────────────────────────────────────────────────────

@admin_required
def polls_panel(request):
    polls = Poll.objects.prefetch_related('options').all()
    stats = {
        'total':     polls.count(),
        'draft':     polls.filter(status='draft').count(),
        'scheduled': polls.filter(status='scheduled').count(),
        'live':      polls.filter(status='live').count(),
        'closed':    polls.filter(status='closed').count(),
        'votes':     Vote.objects.count(),
    }
    stats_list = [
        ('Total', stats['total'], 'var(--text)'),
        ('Draft', stats['draft'], '#94a3b8'),
        ('Scheduled', stats['scheduled'], 'var(--warning)'),
        ('Live', stats['live'], 'var(--success)'),
        ('Closed', stats['closed'], '#64748b'),
        ('Votes', stats['votes'], 'var(--primary)'),
    ]
    return render(request, 'panel/polls_list.html', {
        'polls': polls, 'stats': stats, 'stats_list': stats_list,
    })


# ── Create / Edit ────────────────────────────────────────────────────────────

@admin_required
def poll_create(request):
    from apps.schedule.models import ScheduleSession
    sessions = ScheduleSession.objects.filter(is_published=True).order_by('day', 'start_datetime')

    if request.method == 'POST':
        title   = request.POST.get('title', '').strip()
        question = request.POST.get('question', '').strip()
        if not title or not question:
            messages.error(request, 'Title and question are required.')
            return render(request, 'panel/poll_form.html', {
                'mode': 'create', 'sessions': sessions, 'form': request.POST,
                'poll_types': Poll.Type.choices,
                'result_vis_choices': Poll.ResultVis.choices,
            })

        poll = Poll.objects.create(
            title=title,
            question=question,
            description=request.POST.get('description', '').strip(),
            poll_type=request.POST.get('poll_type', 'single'),
            status='draft',
            result_vis=request.POST.get('result_vis', 'after'),
            is_ideathon=request.POST.get('is_ideathon') == 'on',
            starts_at=_parse_dt(request.POST.get('starts_at')),
            ends_at=_parse_dt(request.POST.get('ends_at')),
            max_choices=int(request.POST.get('max_choices') or 1),
            award_points=request.POST.get('award_points') == 'on',
            created_by=request.user,
            session_id=request.POST.get('session_id') or None,
        )
        PollAuditLog.objects.create(poll=poll, admin=request.user, action='created')
        _save_options(request, poll)
        messages.success(request, f'Poll "{poll.title}" created.')
        return redirect('polls_edit', pk=poll.pk)

    return render(request, 'panel/poll_form.html', {
        'mode': 'create', 'sessions': sessions,
        'poll_types': Poll.Type.choices,
        'result_vis_choices': Poll.ResultVis.choices,
        'form': {},
    })


@admin_required
def poll_edit(request, pk):
    poll = get_object_or_404(Poll, pk=pk)
    from apps.schedule.models import ScheduleSession
    sessions = ScheduleSession.objects.filter(is_published=True).order_by('day', 'start_datetime')

    if request.method == 'POST':
        poll.title       = request.POST.get('title', poll.title).strip()
        poll.question    = request.POST.get('question', poll.question).strip()
        poll.description = request.POST.get('description', '').strip()
        poll.poll_type   = request.POST.get('poll_type', poll.poll_type)
        poll.result_vis  = request.POST.get('result_vis', poll.result_vis)
        poll.is_ideathon = request.POST.get('is_ideathon') == 'on'
        poll.starts_at   = _parse_dt(request.POST.get('starts_at'))
        poll.ends_at     = _parse_dt(request.POST.get('ends_at'))
        poll.max_choices = int(request.POST.get('max_choices') or 1)
        poll.award_points= request.POST.get('award_points') == 'on'
        poll.session_id  = request.POST.get('session_id') or None
        poll.save()

        poll.options.all().delete()
        _save_options(request, poll)

        PollAuditLog.objects.create(poll=poll, admin=request.user, action='edited')
        messages.success(request, f'Poll "{poll.title}" updated.')
        return redirect('polls_panel')

    return render(request, 'panel/poll_form.html', {
        'mode': 'edit', 'poll': poll,
        'sessions': sessions,
        'poll_types': Poll.Type.choices,
        'result_vis_choices': Poll.ResultVis.choices,
    })


@admin_required
def poll_delete(request, pk):
    poll = get_object_or_404(Poll, pk=pk)
    if request.method == 'POST':
        if poll.status == Poll.Status.LIVE:
            messages.error(request, f'Cannot delete a live poll. Close it first.')
            return redirect('polls_panel')
        title = poll.title
        poll.delete()
        messages.success(request, f'Poll "{title}" deleted.')
    return redirect('polls_panel')


# ── Start / Close / Reopen ───────────────────────────────────────────────────

@admin_required
def poll_start(request, pk):
    poll = get_object_or_404(Poll, pk=pk)
    if request.method == 'POST':
        if poll.options.count() < 2:
            messages.error(request, 'Add at least 2 options before starting.')
            return redirect('polls_panel')
        poll.status = Poll.Status.LIVE
        if not poll.starts_at:
            poll.starts_at = timezone.now()
        poll.save()
        PollAuditLog.objects.create(poll=poll, admin=request.user, action='started')
        _notify_poll_live(poll, request)
        messages.success(request, f'"{poll.title}" is now LIVE. All users notified.')
    return redirect('polls_panel')


@admin_required
def poll_close(request, pk):
    poll = get_object_or_404(Poll, pk=pk)
    if request.method == 'POST':
        poll.status = Poll.Status.CLOSED
        if not poll.ends_at:
            poll.ends_at = timezone.now()
        poll.save()
        PollAuditLog.objects.create(poll=poll, admin=request.user, action='closed')
        messages.success(request, f'"{poll.title}" closed.')
    return redirect('polls_panel')


@admin_required
def poll_reopen(request, pk):
    poll = get_object_or_404(Poll, pk=pk)
    if request.method == 'POST':
        poll.status = Poll.Status.LIVE
        poll.ends_at = None
        poll.save()
        PollAuditLog.objects.create(poll=poll, admin=request.user, action='reopened')
        _notify_poll_live(poll, request)
        messages.success(request, f'"{poll.title}" reopened. All users notified.')
    return redirect('polls_panel')


# ── Results / Analytics ──────────────────────────────────────────────────────

@admin_required
def poll_results(request, pk):
    from .models import Vote
    from apps.accounts.models import User as AuthUser
    poll = get_object_or_404(Poll, pk=pk)
    results = poll.results()
    logs = poll.audit_logs.select_related('admin').all()[:20]
    total = poll.total_votes

    # Voter list
    votes = Vote.objects.filter(poll=poll).select_related('user', 'option').order_by('-created_at')
    voters = [{
        'user_id':   str(v.user.id),
        'name':      v.user.get_full_name() or v.user.email,
        'email':     v.user.email,
        'option':    v.option.text,
        'option_id': str(v.option_id),
        'voted_at':  v.created_at.strftime('%Y-%m-%d %H:%M'),
    } for v in votes]

    voted_ids = {v['user_id'] for v in voters}

    # Non-voters
    non_voters = []
    if poll.is_ideathon:
        from .ideathon_models import IdeathonTeam
        for team in IdeathonTeam.objects.select_related('leader').all():
            if str(team.leader_id) not in voted_ids:
                non_voters.append({
                    'name': team.leader.get_full_name(),
                    'email': team.leader.email,
                    'team': team.name,
                })
    else:
        from apps.checkins.models import CheckIn
        eligible_ids = set(str(uid) for uid in CheckIn.objects.filter(
            checkin_type='conference'
        ).values_list('user_id', flat=True))
        for u in AuthUser.objects.filter(
            id__in=eligible_ids - voted_ids, role='participant', is_active=True
        ).order_by('first_name')[:100]:
            non_voters.append({'name': u.get_full_name(), 'email': u.email, 'team': ''})

    eligible_count = len(voters) + len(non_voters)
    participation_pct = round(len(voters) * 100 / eligible_count, 1) if eligible_count else 0

    return render(request, 'panel/poll_results.html', {
        'poll':             poll,
        'results':          results,
        'total_votes':      total,
        'logs':             logs,
        'voters':           voters,
        'non_voters':       non_voters[:50],
        'non_voter_count':  len(non_voters),
        'eligible_count':   eligible_count,
        'participation_pct': participation_pct,
    })


@admin_required
def poll_export(request, pk):
    poll = get_object_or_404(Poll, pk=pk)
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="poll_{pk}_results.csv"'
    writer = csv.writer(response)

    # Sheet 1: summary
    writer.writerow(['=== RESULTS SUMMARY ==='])
    writer.writerow(['Poll', poll.title])
    writer.writerow(['Question', poll.question])
    writer.writerow(['Status', poll.status])
    writer.writerow(['Total Votes', poll.total_votes])
    writer.writerow([])
    writer.writerow(['Option', 'Votes', 'Percentage'])
    for r in poll.results():
        writer.writerow([r['text'], r['votes'], f"{r['pct']}%"])

    # Sheet 2: voter list
    writer.writerow([])
    writer.writerow(['=== VOTER LIST ==='])
    writer.writerow(['Name', 'Email', 'Voted For', 'Voted At'])
    from .models import Vote
    for v in Vote.objects.filter(poll=poll).select_related('user', 'option').order_by('-created_at'):
        writer.writerow([
            v.user.get_full_name(),
            v.user.email,
            v.option.text,
            v.created_at.strftime('%Y-%m-%d %H:%M'),
        ])
    return response


# ── Helper ───────────────────────────────────────────────────────────────────

def _save_options(request, poll):
    texts        = request.POST.getlist('option_text')
    team_names   = request.POST.getlist('team_name')
    team_members = request.POST.getlist('team_members')
    proj_titles  = request.POST.getlist('project_title')
    proj_descs   = request.POST.getlist('project_desc')

    for i, text in enumerate(texts):
        text = text.strip()
        if not text:
            continue
        PollOption.objects.create(
            poll=poll,
            text=text,
            order=i,
            team_name=team_names[i].strip() if i < len(team_names) else '',
            team_members=team_members[i].strip() if i < len(team_members) else '',
            project_title=proj_titles[i].strip() if i < len(proj_titles) else '',
            project_desc=proj_descs[i].strip() if i < len(proj_descs) else '',
        )
