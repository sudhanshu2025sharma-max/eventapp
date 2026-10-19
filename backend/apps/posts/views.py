from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Count, Prefetch
from django.db import transaction
from django.core.exceptions import ValidationError

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from rest_framework import status

from .models import FeedPost, FeedReaction, FeedComment, FeedQuizResponse, REACTION_CHOICES
from .quiz import apply_feed_extras, apply_feed_content
from apps.accounts.permissions_helper import api_module_required
import base64
import uuid
from django.core.files.base import ContentFile

def _process_base64_image(b64_str, prefix='feed_'):
    if not b64_str or not isinstance(b64_str, str):
        return None
    try:
        if 'base64,' in b64_str:
            header, data_str = b64_str.split('base64,', 1)
            ext = 'png' if 'image/png' in header else 'mp4' if 'video/mp4' in header else 'jpg'
        else:
            data_str = b64_str
            ext = 'jpg'

        data_str = data_str.encode('ascii', 'ignore').decode('ascii').strip()
        missing_padding = len(data_str) % 4
        if missing_padding:
            data_str += '=' * (4 - missing_padding)

        img_data = base64.b64decode(data_str)
        file_name = f"{prefix}{uuid.uuid4().hex[:8]}.{ext}"
        return ContentFile(img_data, name=file_name)
    except Exception as e:
        print(f"[FEED BASE64 ERROR] {e}")
        return None



def _is_true(val, default=False):
    if val is None:
        return default
    if isinstance(val, bool):
        return val
    return str(val).strip().lower() in ('1', 'true', 'yes', 'on')


def _live_posts_qs():
    now = timezone.now()
    return (
        FeedPost.objects
        .filter(published_at__isnull=False, published_at__lte=now)
        .select_related('author', 'session')
        .annotate(comment_count=Count('comments', distinct=True),
                  quiz_response_count=Count('quiz_responses', distinct=True))
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


def _quiz_payload(request, post, admin=False):
    if post.post_type != 'quiz':
        return None
    if hasattr(post, 'my_quiz_responses'):
        answer = next(iter(post.my_quiz_responses), None)
    else:
        answer = post.quiz_responses.filter(user=request.user).first()
    revealed = admin or answer is not None
    payload = {
        'type': post.quiz_type,
        'question': post.quiz_question,
        'options': post.quiz_options,
        'response_count': post.quiz_response_count if hasattr(post, 'quiz_response_count') else post.quiz_responses.count(),
        'selected_option': answer.selected_option if answer else None,
        'answered': answer is not None,
        'has_correct_answer': post.quiz_correct_option is not None,
    }
    if revealed:
        payload['correct_option'] = post.quiz_correct_option
    if answer:
        payload['is_correct'] = (answer.selected_option == post.quiz_correct_option
                                 if post.quiz_correct_option is not None else None)
    if admin:
        counts = dict(post.quiz_responses.values('selected_option').annotate(total=Count('id')).values_list('selected_option', 'total'))
        payload['option_counts'] = [counts.get(i, 0) for i in range(len(post.quiz_options))]
    return payload


def _post_payload(request, post, my_reaction=None, admin=False):
    author_name = 'ETD 2026'
    try:
        if post.author:
            author_name = post.author.get_full_name().strip() or post.author.email
    except Exception:
        pass

    session_obj = None
    try:
        session_obj = post.session
    except Exception:
        session_obj = None

    poll_id = None
    try:
        if post.poll_id:
            poll_id = str(post.poll_id)
    except Exception:
        poll_id = None

    return {
        'id': str(post.id),
        'title': post.title,
        'body': post.body,
        'link_url': post.link_url,
        'quiz': _quiz_payload(request, post, admin=admin),
        'post_type': post.post_type,
        'image_url': _image_url(request, post),
        'pinned': post.pinned,
        'allow_comments': post.allow_comments,
        'send_push': post.send_push,
        'published_at': post.published_at.isoformat() if post.published_at else None,
        'scheduled_at': post.scheduled_at.isoformat() if post.scheduled_at else None,
        'author_name': author_name,
        'author_role': 'Organizer',
        'session': _session_payload(session_obj),
        'poll_id': poll_id,
        'comment_count': post.comment_count if hasattr(post, 'comment_count') else post.comments.count(),
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
        ],
    }


def _dispatch_feed_push(post, sent_by=None, request=None):
    """
    Dispatch push notification for feed post using fcm.send_to_all(title, body, data, notif, request).
    """
    title = f"📢 {post.title or post.quiz_question}"[:120]
    body = (post.body or '')[:240]
    data = {
        'type': 'feed_post',
        'screen': 'feed',
        'post_id': str(post.id),
    }

    print(f"[FEED PUSH] dispatch start post={post.id} title={title!r}")

    try:
        from apps.notifications.models import Notification
        from apps.notifications import fcm

        # 1. Create Notification row
        notif = Notification.objects.create(
            title=title,
            body=body,
            data=data,
            target_type='all',
            status='pending',
            sent_by=sent_by,
        )
        print(f"[FEED PUSH] Notification created id={notif.id}")

        # 2. Dispatch via fcm.send_to_all with exact required signature
        res = fcm.send_to_all(title=title, body=body, data=data, notif=notif, request=request)
        print(f"[FEED PUSH] fcm.send_to_all result={res!r}")

        # 3. Refresh from DB to confirm status / counts
        notif.refresh_from_db()
        return True, 'fcm.send_to_all', notif.sent_count, str(notif.id)

    except Exception as e:
        print(f"[FEED PUSH] Error: {type(e).__name__}: {e}")
        if 'notif' in locals() and notif:
            notif.status = 'failed'
            notif.save(update_fields=['status'])
            return False, 'fcm_failed', 0, str(notif.id)
        return False, 'fcm_failed', 0, None


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def feed_list(request):
    qs = _live_posts_qs().prefetch_related(Prefetch(
        'quiz_responses', queryset=FeedQuizResponse.objects.filter(user=request.user),
        to_attr='my_quiz_responses'))
    paginator = PageNumberPagination()
    paginator.page_size = 20
    page = paginator.paginate_queryset(qs, request)

    my_reactions = {
        str(post_id): reaction_type
        for post_id, reaction_type in FeedReaction.objects.filter(
            user=request.user, post__in=page
        ).values_list('post_id', 'reaction_type')
    }

    data = [
        _post_payload(request, post, my_reaction=my_reactions.get(str(post.id)))
        for post in page
    ]
    return paginator.get_paginated_response(data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def answer_quiz(request, pk):
    # Serialize submissions and edits on the parent row, including concurrent retries.
    post = get_object_or_404(
        FeedPost.objects.select_for_update().filter(
            published_at__isnull=False, published_at__lte=timezone.now()), pk=pk)
    if post.post_type != 'quiz':
        return Response({'detail': 'This post is not a quiz.'}, status=400)
    selected = request.data.get('selected_option')
    if type(selected) is not int or not 0 <= selected < len(post.quiz_options):
        return Response({'detail': 'Select a valid answer.'}, status=400)
    answer, created = FeedQuizResponse.objects.get_or_create(
        post=post, user=request.user, defaults={'selected_option': selected})
    return Response({'success': True, 'quiz': _quiz_payload(request, post)}, status=201 if created else 200)


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
        return Response(
            {'detail': e.message_dict if hasattr(e, 'message_dict') else e.messages},
            status=status.HTTP_400_BAD_REQUEST,
        )

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
            },
        }, status=status.HTTP_201_CREATED)

    comment = FeedComment.objects.select_related('user').prefetch_related('replies__user').get(pk=comment.pk)
    return Response({'success': True, 'comment': _comment_payload(comment)}, status=status.HTTP_201_CREATED)


# -------------------------------------------------------------
# ADMIN API
# -------------------------------------------------------------
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@api_module_required('feed')
def admin_feed_list(request):
    if request.user.role not in ('super_admin', 'mgmt_admin', 'team_head', 'staff'):
        return Response({'detail': 'Not allowed'}, status=403)

    if request.method == 'GET':
        qs = FeedPost.objects.select_related('author', 'session').prefetch_related('reactions').annotate(
            comment_count=Count('comments', distinct=True),
            quiz_response_count=Count('quiz_responses', distinct=True)).order_by('-created_at')
        return Response({'success': True, 'results': [_post_payload(request, p, admin=True) for p in qs]})

    data = request.data
    want_push = _is_true(data.get('send_push'), False)

    post = FeedPost(
        author=request.user,
        post_type=data.get('post_type') or 'general',
        pinned=_is_true(data.get('pinned'), False),
        allow_comments=_is_true(data.get('allow_comments'), True),
        send_push=want_push,
        published_at=timezone.now(),
    )
    try:
        apply_feed_extras(post, data)
        apply_feed_content(post, data)
    except ValidationError as exc:
        return Response({'detail': ' '.join(exc.messages)}, status=400)
    if 'image' in request.FILES:
        post.image = request.FILES['image']
    elif 'image_base64' in data and data['image_base64']:
        b64_file = _process_base64_image(data['image_base64'], prefix='feed_create_')
        if b64_file:
            post.image = b64_file
    post.save()
    print(f"[FEED ADMIN] created post={post.id} send_push={want_push}")

    push_ok, push_via, push_sent_count, notif_id = False, 'skipped', 0, None
    if want_push:
        push_ok, push_via, push_sent_count, notif_id = _dispatch_feed_push(
            post, sent_by=request.user, request=request
        )

    return Response({
        'success': True,
        'post': _post_payload(request, post, admin=True),
        'push_sent': push_ok,
        'push_via': push_via,
        'push_sent_count': push_sent_count,
        'notification_id': notif_id,
    })


@api_view(['PATCH', 'POST', 'DELETE'])
@permission_classes([IsAuthenticated])
@api_module_required('feed')
@transaction.atomic
def admin_feed_detail(request, pk):
    if request.user.role not in ('super_admin', 'mgmt_admin', 'team_head', 'staff'):
        return Response({'detail': 'Not allowed'}, status=403)

    post = get_object_or_404(FeedPost.objects.select_for_update(), pk=pk)

    if request.method in ('PATCH', 'POST'):
        data = request.data
        try:
            apply_feed_extras(post, data)
            apply_feed_content(post, data)
        except ValidationError as exc:
            return Response({'detail': ' '.join(exc.messages)}, status=400)
        if 'post_type' in data:
            post.post_type = data.get('post_type') or post.post_type
        if 'pinned' in data:
            post.pinned = _is_true(data.get('pinned'), post.pinned)
        if 'allow_comments' in data:
            post.allow_comments = _is_true(data.get('allow_comments'), post.allow_comments)

        img_file = request.FILES.get('image')
        if img_file is None and 'image_base64' in data and data['image_base64']:
            img_file = _process_base64_image(data['image_base64'], prefix='feed_update_')
        if img_file is not None:
            post.image = img_file

        post.save()
        return Response({'success': True, 'post': _post_payload(request, post, admin=True)})

    post.delete()
    return Response({'success': True})


@api_view(['GET', 'DELETE'])
@permission_classes([IsAuthenticated])
@api_module_required('feed')
def admin_feed_comments(request, pk, comment_id=None):
    if request.user.role not in ('super_admin', 'mgmt_admin', 'team_head', 'staff'):
        return Response({'detail': 'Not allowed'}, status=403)

    if request.method == 'GET':
        comments = (
            FeedComment.objects
            .filter(post_id=pk)
            .select_related('user')
            .prefetch_related('replies__user')
            .order_by('-created_at')
        )
        return Response({'success': True, 'results': [_comment_payload(c) for c in comments]})

    comment = get_object_or_404(FeedComment, pk=comment_id, post_id=pk)
    comment.delete()
    return Response({'success': True})
