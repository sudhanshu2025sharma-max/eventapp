from django.db import models
from django.conf import settings
from django.utils import timezone
import uuid


REACTION_CHOICES = [
    ('like',      '👍'),
    ('love',      '❤️'),
    ('haha',      '😂'),
    ('wow',       '😮'),
    ('sad',       '😢'),
    ('celebrate', '🎉'),
]


class FeedPost(models.Model):
    POST_TYPES = [
        ('announcement', 'Announcement'),
        ('update',       'Update'),
        ('alert',        'Alert'),
        ('general',      'General'),
    ]

    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title          = models.CharField(max_length=300)
    body           = models.TextField()
    post_type      = models.CharField(max_length=20, choices=POST_TYPES, default='general')
    image          = models.ImageField(upload_to='feed/', null=True, blank=True)
    pinned         = models.BooleanField(default=False)
    allow_comments = models.BooleanField(default=True)
    send_push      = models.BooleanField(default=True)
    push_sent      = models.BooleanField(default=False)

    session        = models.ForeignKey(
                       'schedule.ScheduleSession',
                       null=True, blank=True,
                       on_delete=models.SET_NULL,
                       related_name='feed_posts')

    # poll FK added later when polls app is built
    poll_id        = models.UUIDField(null=True, blank=True,
                       help_text='Future: link to Poll once polls app is ready')

    author         = models.ForeignKey(
                       settings.AUTH_USER_MODEL,
                       on_delete=models.SET_NULL,
                       null=True,
                       related_name='feed_posts')

    scheduled_at   = models.DateTimeField(null=True, blank=True,
                       help_text='Leave blank to publish immediately')
    published_at   = models.DateTimeField(null=True, blank=True)
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'feed_posts'
        ordering = ['-pinned', '-published_at', '-created_at']

    def __str__(self):
        return f"[{self.post_type}] {self.title}"

    @property
    def is_live(self):
        if not self.published_at:
            return False
        return self.published_at <= timezone.now()

    def save(self, *args, **kwargs):
        # Immediate publish: no scheduled_at and no published_at yet
        if not self.scheduled_at and not self.published_at:
            self.published_at = timezone.now()
        super().save(*args, **kwargs)


class FeedReaction(models.Model):
    post          = models.ForeignKey(FeedPost, on_delete=models.CASCADE, related_name='reactions')
    user          = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='feed_reactions')
    reaction_type = models.CharField(max_length=20, choices=REACTION_CHOICES)
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table        = 'feed_reactions'
        unique_together = [('post', 'user')]

    def __str__(self):
        return f"{self.user.email} {self.reaction_type} on '{self.post.title[:40]}'"


class FeedComment(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    post       = models.ForeignKey(FeedPost, on_delete=models.CASCADE, related_name='comments')
    user       = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='feed_comments')
    parent     = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='replies')
    body       = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'feed_comments'
        ordering = ['created_at']

    def __str__(self):
        return f"{self.user.email} on '{self.post.title[:30]}'"

    def clean(self):
        if self.parent and self.parent.parent_id:
            from django.core.exceptions import ValidationError
            raise ValidationError('Replies cannot be nested more than 1 level.')
