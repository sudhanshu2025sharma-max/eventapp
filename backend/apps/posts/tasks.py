import logging
from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task
def publish_scheduled_posts():
    from apps.posts.models import FeedPost
    now = timezone.now()
    pending = FeedPost.objects.filter(
        scheduled_at__lte=now,
        published_at__isnull=True,
    )
    count = 0
    for post in pending:
        post.published_at = now
        post.save(update_fields=['published_at'])
        if post.send_push and not post.push_sent:
            send_post_push(str(post.id))  # direct call — no Celery on VM
        count += 1
    if count:
        logger.info(f'[Feed] Published {count} scheduled post(s)')
    return count


@shared_task
def send_post_push(post_id):
    from apps.posts.models import FeedPost
    from apps.notifications.models import DeviceToken
    from apps.notifications.fcm import send_to_tokens

    try:
        post = FeedPost.objects.get(id=post_id)
    except FeedPost.DoesNotExist:
        logger.warning(f'[Feed] Post not found: {post_id}')
        return {'success': 0, 'failed': 0, 'tokens': 0, 'error': 'post_not_found'}

    if post.push_sent:
        logger.info(f'[Feed] Push already marked sent for post {post.id}')
        return {'success': 0, 'failed': 0, 'tokens': 0, 'error': 'already_sent'}

    type_labels = {
        'announcement': '📢 Announcement',
        'update':       '🔔 Update',
        'alert':        '⚠️ Alert',
        'general':      '📌 Post',
    }
    title = type_labels.get(post.post_type, '📌 Post')
    body  = post.title

    tokens = list(
        DeviceToken.objects.filter(is_active=True)
        .values_list('token', flat=True)
        .distinct()
    )

    logger.info(f'[Feed] Attempting push for post {post.id} | title={post.title!r} | tokens={len(tokens)}')

    if not tokens:
        logger.warning(f'[Feed] No active device tokens for post {post.id}')
        return {'success': 0, 'failed': 0, 'tokens': 0, 'error': 'no_tokens'}

    try:
        success, failed, bad = send_to_tokens(
            tokens,
            title,
            body,
            {'type': 'feed_post', 'post_id': str(post.id)}
        )
        logger.info(f'[Feed] Push result for post {post.id}: success={success} failed={failed} bad={len(bad)}')

        # Mark sent only if at least one push was accepted
        if success > 0:
            post.push_sent = True
            post.save(update_fields=['push_sent'])
            logger.info(f'[Feed] push_sent=True for post {post.id}')
        else:
            logger.warning(f'[Feed] Push not marked sent for post {post.id} because success=0')

        return {'success': success, 'failed': failed, 'tokens': len(tokens), 'bad': len(bad)}

    except Exception as e:
        logger.exception(f'[Feed] Push exception for post {post.id}: {e}')
        return {'success': 0, 'failed': len(tokens), 'tokens': len(tokens), 'error': str(e)}
