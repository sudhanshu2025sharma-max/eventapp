import json
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.http import JsonResponse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from zoneinfo import ZoneInfo

from apps.accounts.admin_views import admin_required
from .ideathon_models import IdeathonConfig, IdeathonTeam, IdeathonMember
from .models import Poll, PollOption, PollAuditLog

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


@admin_required
def ideathon_panel(request):
    cfg = IdeathonConfig.get()
    teams = IdeathonTeam.objects.prefetch_related('members__user').all()

    if request.method == 'POST':
        action = request.POST.get('action')

        if action == 'save_config':
            cfg.registration_open = request.POST.get('registration_open') == 'on'
            cfg.reg_starts_at = _parse_dt(request.POST.get('reg_starts_at'))
            cfg.reg_ends_at = _parse_dt(request.POST.get('reg_ends_at'))
            cfg.min_team_size = int(request.POST.get('min_team_size') or 2)
            cfg.max_team_size = int(request.POST.get('max_team_size') or 5)
            cfg.description = request.POST.get('description', '').strip()
            cfg.updated_by = request.user
            cfg.save()
            messages.success(request, 'Ideathon settings saved.')

        elif action == 'toggle_registration':
            cfg.registration_open = not cfg.registration_open
            cfg.updated_by = request.user
            cfg.save()
            state = 'opened' if cfg.registration_open else 'closed'
            messages.success(request, f'Team registration {state}.')

            if cfg.registration_open:
                try:
                    from apps.notifications.models import Notification as Notif
                    from apps.notifications.fcm import send_to_all
                    notif = Notif.objects.create(
                        title='🏆 Ideathon Team Registration is Open!',
                        body='Form your teams now in the app. Teams of 2-5 members.',
                        target_type='all', sent_by=request.user, status='pending',
                        data={'type': 'poll'},
                    )
                    s, f, _ = send_to_all(notif.title, notif.body, notif.data, notif, request)
                    notif.status = 'sent'; notif.sent_count = s; notif.failed_count = f; notif.save()
                except Exception:
                    pass

        elif action == 'delete_team':
            team_id = request.POST.get('team_id')
            try:
                team = IdeathonTeam.objects.get(pk=team_id)
                name = team.name
                team.delete()
                messages.success(request, f'Team "{name}" deleted.')
            except IdeathonTeam.DoesNotExist:
                messages.error(request, 'Team not found.')

        elif action == 'remove_member':
            from django.contrib.auth import get_user_model
            User = get_user_model()
            member_user_id = request.POST.get('member_user_id')
            try:
                mem = IdeathonMember.objects.select_related('team', 'user').get(user_id=member_user_id)
                team = mem.team
                name = mem.user.get_full_name()
                was_leader = team.leader_id == mem.user_id
                mem.delete()
                remaining = team.members.order_by('joined_at')
                if not remaining.exists():
                    team.delete()
                    messages.success(request, f'{name} removed. Team disbanded (empty).')
                elif was_leader:
                    team.leader = remaining.first().user
                    team.save(update_fields=['leader'])
                    messages.success(request, f'{name} removed. New leader: {team.leader.get_full_name()}.')
                else:
                    messages.success(request, f'{name} removed from team.')
            except IdeathonMember.DoesNotExist:
                messages.error(request, 'Member not found.')

        elif action == 'create_voting_poll':
            if teams.count() < 2:
                messages.error(request, 'Need at least 2 teams to create a voting poll.')
            else:
                poll = Poll.objects.create(
                    title='🏆 Ideathon 2026 — Audience Choice',
                    question='Which team presented the most impactful solution?',
                    description='Vote for the team you think deserves the Audience Choice Award!',
                    poll_type='single',
                    status='draft',
                    result_vis='after',
                    is_ideathon=True,
                    award_points=True,
                    created_by=request.user,
                )
                for i, team in enumerate(teams):
                    PollOption.objects.create(
                        poll=poll,
                        text=team.name,
                        order=i,
                        team_name=team.name,
                        team_members=team.member_names,
                        project_title=team.project_title,
                        project_desc=team.project_desc,
                    )
                PollAuditLog.objects.create(
                    poll=poll, admin=request.user,
                    action=f'created from {teams.count()} ideathon teams',
                )
                messages.success(request,
                    f'Voting poll created with {teams.count()} teams. '
                    f'Go to Polls → Start when ready.'
                )
                return redirect('polls_edit', pk=poll.pk)

        return redirect('ideathon_panel')

    return render(request, 'panel/ideathon.html', {
        'cfg': cfg,
        'teams': teams,
        'total_teams': teams.count(),
        'total_members': IdeathonMember.objects.count(),
    })
