from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from apps.checkins.models import CheckIn
from .models import UserPoints, PointEntry, PointAction
from apps.accounts.permissions_helper import module_required


@login_required
@module_required('leaderboard')
def leaderboard_panel(request):
    checked_in_ids = CheckIn.objects.filter(
        checkin_type='conference'
    ).values_list('user_id', flat=True)

    entries = UserPoints.objects.select_related('user').filter(
        user_id__in=checked_in_ids,
    ).order_by('-total_points', 'updated_at', 'user_id')

    # Sequential ranks — timestamp breaks ties (first to reach score wins)
    board = []
    for idx, e in enumerate(entries, 1):
        recent = PointEntry.objects.filter(user=e.user).order_by('-created_at')[:5]
        board.append({
            'rank': idx,
            'user': e.user,
            'points': e.total_points,
            'recent': recent,
        })

    total_checked = len(checked_in_ids)
    total_ranked = len(board)

    # Action breakdown
    from django.db.models import Sum, Count
    action_stats = PointEntry.objects.filter(
        user_id__in=checked_in_ids,
    ).values('action').annotate(
        total=Sum('points'),
        count=Count('id'),
    ).order_by('-total')

    action_labels = dict(PointAction.choices)

    return render(request, 'panel/leaderboard.html', {
        'board': board,
        'total_checked': total_checked,
        'total_ranked': total_ranked,
        'action_stats': [
            {
                'action': s['action'],
                'label': action_labels.get(s['action'], s['action']),
                'total': s['total'],
                'count': s['count'],
            }
            for s in action_stats
        ],
    })
