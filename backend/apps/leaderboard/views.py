from django.db import models
from django.db.models import Sum, Count, Q
from django.core.cache import cache
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.checkins.models import CheckIn
from .models import UserPoints, PointEntry


def _checked_in_user_ids():
    return list(CheckIn.objects.filter(
        checkin_type='conference'
    ).values_list('user_id', flat=True))


def _photo_url(user, request):
    if user.profile_photo:
        return request.build_absolute_uri(user.profile_photo.url)
    return None


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_points(request):
    """
    Return current user's total points, checked-in leaderboard rank,
    recent activity and score breakdown with consistent tie-breaking.
    """
    summary, _ = UserPoints.objects.get_or_create(user=request.user)
    checked_in_ids = _checked_in_user_ids()
    eligible = request.user.id in checked_in_ids

    total = summary.total_points
    rank = summary.rank if eligible else 0

    higher = None
    if eligible:
        higher = UserPoints.objects.select_related('user').filter(
            user__role='participant',
            user_id__in=checked_in_ids,
        ).filter(
            models.Q(total_points__gt=total) |
            models.Q(total_points=total, updated_at__lt=summary.updated_at) |
            models.Q(total_points=total, updated_at=summary.updated_at, user_id__lt=summary.user_id)
        ).order_by('-total_points', 'updated_at', 'user_id').first()

    recent = PointEntry.objects.filter(user=request.user)[:15]
    history = [
        {
            'action': e.action,
            'action_display': e.get_action_display(),
            'points': e.points,
            'note': e.note,
            'date': e.created_at.isoformat(),
        }
        for e in recent
    ]

    breakdown = {}
    agg = PointEntry.objects.filter(user=request.user).values('action').annotate(total=Sum('points'))
    for row in agg:
        breakdown[row['action']] = row['total']

    return Response({
        'eligible': eligible,
        'total_points': total,
        'rank': rank,
        'next_rank_points': higher.total_points if higher else None,
        'next_rank_name': (higher.user.get_full_name() or higher.user.email.split('@')[0]) if higher else None,
        'next_gap': (higher.total_points - total) if higher else 0,
        'history': history,
        'breakdown': breakdown,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def leaderboard(request):
    """
    Top 50 checked-in participants by points.
    Ties are strictly resolved by timestamp of score changes.
    Cached securely for 5 minutes.
    """
    checked_in_ids = _checked_in_user_ids()
    cache_key = f'leaderboard_top_50_v4_{len(checked_in_ids)}'
    cached_data = cache.get(cache_key)

    if cached_data is None:
        # Resolve order: total points, earliest updated_at, stable user_id fallback
        top_qs = UserPoints.objects.select_related('user').filter(
            user__role='participant',
            user_id__in=checked_in_ids,
        ).order_by('-total_points', 'updated_at', 'user_id')[:50]

        # Compute point values that are shared by multiple checked-in users (ties)
        tied_points_list = list(
            UserPoints.objects.filter(
                user__role='participant',
                user_id__in=checked_in_ids
            ).values('total_points').annotate(
                cnt=Count('id')
            ).filter(cnt__gt=1).values_list('total_points', flat=True)
        )
        tied_points = set(tied_points_list)

        base_list = []
        for idx, entry in enumerate(top_qs, start=1):
            u = entry.user
            base_list.append({
                'rank': idx,
                'user_id': str(u.id),
                'name': u.get_full_name() or u.email.split('@')[0],
                'email': u.email,
                'points': entry.total_points,
                'affiliation': u.affiliation or '',
                'profile_photo_url': u.profile_photo.url if u.profile_photo else None,
                'is_tied': entry.total_points in tied_points,
            })

        cached_data = {
            'base_list': base_list,
            'tied_points': list(tied_points),
            'total_participants': UserPoints.objects.filter(
                user__role='participant',
                user_id__in=checked_in_ids
            ).count()
        }
        # Secure base cache for 5 minutes
        cache.set(cache_key, cached_data, timeout=300)

    # Hydrate customized request fields (profile photos with domain, is_me) live
    base_list = cached_data['base_list']
    tied_points = set(cached_data['tied_points'])
    total_participants = cached_data['total_participants']

    leaderboard_data = []
    for entry in base_list:
        is_me = (entry['user_id'] == str(request.user.id))
        photo_url = request.build_absolute_uri(entry['profile_photo_url']) if entry['profile_photo_url'] else None
        leaderboard_data.append({
            **entry,
            'is_me': is_me,
            'profile_photo_url': photo_url,
        })

    # Retrieve and calculate client rank info
    my_summary, _ = UserPoints.objects.get_or_create(user=request.user)
    my_eligible = request.user.id in checked_in_ids
    my_rank = my_summary.rank if my_eligible else 0

    my_entry = None
    if my_eligible:
        u = request.user
        my_entry = {
            'rank': my_rank,
            'user_id': str(u.id),
            'name': u.get_full_name() or u.email.split('@')[0],
            'email': u.email,
            'points': my_summary.total_points,
            'affiliation': u.affiliation or '',
            'profile_photo_url': request.build_absolute_uri(u.profile_photo.url) if u.profile_photo else None,
            'is_me': True,
            'is_tied': my_summary.total_points in tied_points,
        }

    return Response({
        'leaderboard': leaderboard_data,
        'my_rank': my_rank,
        'my_points': my_summary.total_points,
        'my_in_top': any(d['is_me'] for d in leaderboard_data),
        'my_entry': my_entry,
        'total_participants': total_participants,
    })
