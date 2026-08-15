from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Count
from django.core.exceptions import ValidationError

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from rest_framework import status

from .models import FeedPost, FeedReaction, FeedComment, REACTION_CHOICES


def _live_posts_qs():
    now = timezone.now()
    return (
        FeedPost.objects
        .filter(published_at__isnull=False, published_at__lte=now)
        .select_related('author', 'session')
        .annotate(comment_count=Count('comments', distinct=True))
        .prefetch_related('reactions')
        .order_by('-pinned', '-published_at', '-created_at')
    )


def _get_live_post(pk):
    return get_object_or_404(_live_posts_qs(), pk=pk)


def _image_url(request, post):
    if not post.image:
        return None
    try:
        return request.build_absolute_uri(post.image.url)
    except Exception:
        return post.image.url


def _reaction_summary(post):
    summary = {k: 0 for k, _ in REACTION_CHOICES}
    for r in post.reactions.all():
        summary[r.reaction_type] = summary.get(r.reaction_type, 0) + 1
    return summary


def _session_payload(session):
    if not session:
        return None
    return {
        'id': str(session.id),
        'day': session.day,
        'title': session.title,
        'start_datetime': session.start_datetime.isoformat() if session.start_datetime else None,
        'end_datetime': session.end_datetime.isoformat() if session.end_datetime else None,
        'room': session.room,
        'session_type': session.session_type,
    }


def _post_payload(request, post, my_reaction=None):
    author_name = 'ETD 2026'
    if post.author:
        author_name = post.author.get_full_name().strip() or post.author.email

    return {
        'id': str(post.id),
        'title': post.title,
        'body': post.body,
        'post_type': post.post_type,
        'image_url': _image_url(request, post),
        'pinned': post.pinned,
        'allow_comments': post.allow_comments,
        'send_push': post.send_push,
        'published_at': post.published_at.isoformat() if post.published_at else None,
        'scheduled_at': post.scheduled_at.isoformat() if post.scheduled_at else None,
        'author_name': author_name,
        'author_role': 'Organizer',
        'session': _session_payload(post.session),
        'poll_id': str(post.poll_id) if post.poll_id else None,
        'comment_count': getattr(post, 'comment_count', post.comments.count()),
        'reaction_summary': _reaction_summary(post),
        'my_reaction': my_reaction,
    }


def _comment_payload(comment):
    user_name = comment.user.get_full_name().strip() or comment.user.email
    return {
        'id': str(comment.id),
        'body': comment.body,
        'created_at': comment.created_at.isoformat(),
        'user_name': user_name,
        'parent_id': str(comment.parent_id) if comment.parent_id else None,
        'replies': [
            {
                'id': str(reply.id),
                'body': reply.body,
                'created_at': reply.created_at.isoformat(),
                'user_name': reply.user.get_full_name().strip() or reply.user.email,
                'parent_id': str(reply.parent_id) if reply.parent_id else None,
            }
            for reply in comment.replies.all().select_related('user').order_by('created_at')
        ]
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def feed_list(request):
    qs = _live_posts_qs()

    paginator = PageNumberPagination()
    paginator.page_size = 20
    page = paginator.paginate_queryset(qs, request)

    my_reactions = {
        str(post_id): reaction_type
        for post_id, reaction_type in FeedReaction.objects.filter(
            user=request.user,
            post__in=page
        ).values_list('post_id', 'reaction_type')
    }

    data = [
        _post_payload(request, post, my_reaction=my_reactions.get(str(post.id)))
        for post in page
    ]
    return paginator.get_paginated_response(data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def react_post(request, pk):
    post = _get_live_post(pk)
    reaction_type = (request.data.get('reaction_type') or '').strip()

    valid = {k for k, _ in REACTION_CHOICES}
    existing = FeedReaction.objects.filter(post=post, user=request.user).first()
    action = 'none'
    my_reaction = None

    if not reaction_type:
        if existing:
            existing.delete()
            action = 'removed'
    else:
        if reaction_type not in valid:
            return Response({'detail': 'Invalid reaction type.'}, status=status.HTTP_400_BAD_REQUEST)

        if existing and existing.reaction_type == reaction_type:
            existing.delete()
            action = 'removed'
        elif existing:
            existing.reaction_type = reaction_type
            existing.save(update_fields=['reaction_type'])
            action = 'updated'
            my_reaction = reaction_type
        else:
            FeedReaction.objects.create(post=post, user=request.user, reaction_type=reaction_type)
            action = 'created'
            my_reaction = reaction_type

    post = FeedPost.objects.prefetch_related('reactions').get(pk=post.pk)
    return Response({
        'success': True,
        'action': action,
        'my_reaction': my_reaction,
        'summary': _reaction_summary(post),
    })


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def post_comments(request, pk):
    post = _get_live_post(pk)

    if request.method == 'GET':
        comments = (
            FeedComment.objects
            .filter(post=post, parent__isnull=True)
            .select_related('user')
            .prefetch_related('replies__user')
            .order_by('created_at')
        )
        return Response({
            'success': True,
            'allow_comments': post.allow_comments,
            'results': [_comment_payload(c) for c in comments],
        })

    if not post.allow_comments:
        return Response({'detail': 'Comments are disabled for this post.'}, status=status.HTTP_400_BAD_REQUEST)

    body = (request.data.get('body') or '').strip()
    parent_id = request.data.get('parent_id')

    if not body:
        return Response({'detail': 'Comment body is required.'}, status=status.HTTP_400_BAD_REQUEST)

    parent = None
    if parent_id:
        parent = get_object_or_404(FeedComment, pk=parent_id, post=post)
        if parent.parent_id:
            return Response({'detail': 'Replies cannot be nested more than 1 level.'}, status=status.HTTP_400_BAD_REQUEST)

    comment = FeedComment(post=post, user=request.user, body=body, parent=parent)
    try:
        comment.full_clean()
        comment.save()
    except ValidationError as e:
        return Response({'detail': e.message_dict if hasattr(e, 'message_dict') else e.messages}, status=status.HTTP_400_BAD_REQUEST)

    if parent:
        comment = FeedComment.objects.select_related('user').get(pk=comment.pk)
        return Response({
            'success': True,
            'comment': {
                'id': str(comment.id),
                'body': comment.body,
                'created_at': comment.created_at.isoformat(),
                'user_name': comment.user.get_full_name().strip() or comment.user.email,
                'parent_id': str(comment.parent_id),
            }
        }, status=status.HTTP_201_CREATED)

    comment = FeedComment.objects.select_related('user').prefetch_related('replies__user').get(pk=comment.pk)
    return Response({'success': True, 'comment': _comment_payload(comment)}, status=status.HTTP_201_CREATED)
