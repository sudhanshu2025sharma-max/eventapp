"""
Publish scheduled posts whose scheduled_at time has passed.
Add to crontab:
  * * * * * cd /home/baadalvm/eventapp/backend && python3 manage.py publish_scheduled_posts >> /tmp/posts.log 2>&1
"""
from django.core.management.base import BaseCommand
from django.utils import timezone


class Command(BaseCommand):
    help = 'Publish scheduled feed posts'

    def handle(self, *args, **options):
        from apps.posts.models import FeedPost
        from apps.posts.tasks import send_post_push

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
                try:
                    send_post_push(str(post.id))
                except Exception as e:
                    self.stdout.write(f'Push failed for {post.id}: {e}')
            count += 1
            self.stdout.write(f'Published: {post.title}')

        if count:
            self.stdout.write(self.style.SUCCESS(f'Published {count} scheduled post(s)'))
        else:
            self.stdout.write('No scheduled posts due')
