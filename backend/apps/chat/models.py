import uuid
from django.db import models
from django.conf import settings


TOPIC_CHOICES = [
    ('research_collab',   'Research Collaboration'),
    ('session_discuss',   'Session Discussion'),
    ('digital_libraries', 'Digital Libraries'),
    ('metadata',          'Metadata'),
    ('ai',                'AI'),
    ('open_access',       'Open Access'),
    ('networking',        'Networking'),
    ('career',            'Career'),
    ('other',             'Other'),
]

REQUEST_TYPE_CHOICES = [
    ('contact',  'Contact Card'),
    ('speaker',  'Speaker Discussion'),
]

STATUS_CHOICES = [
    ('pending',  'Pending'),
    ('accepted', 'Accepted'),
    ('declined', 'Declined'),
    ('later',    'Later'),
]

REACTION_CHOICES = [
    ('thumbs_up', '👍'),
    ('heart',     '❤️'),
    ('celebrate', '🎉'),
    ('thinking',  '🤔'),
]


class BlockedUser(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    blocker    = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='blocked_users')
    blocked    = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='blocked_by')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['blocker', 'blocked']
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.blocker.email} blocked {self.blocked.email}"


class ConnectionRequest(models.Model):
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sender       = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sent_requests')
    receiver     = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='received_requests')
    request_type = models.CharField(max_length=10, choices=REQUEST_TYPE_CHOICES, default='contact')
    topic        = models.CharField(max_length=30, choices=TOPIC_CHOICES, default='networking')
    custom_topic = models.CharField(max_length=100, blank=True)
    message      = models.TextField(blank=True)
    status       = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    responded_at = models.DateTimeField(null=True, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.sender.email} → {self.receiver.email} [{self.status}]"

    @property
    def topic_display(self):
        if self.topic == 'other' and self.custom_topic:
            return self.custom_topic
        return dict(TOPIC_CHOICES).get(self.topic, self.topic)


class Conversation(models.Model):
    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request         = models.OneToOneField(ConnectionRequest, on_delete=models.CASCADE, related_name='conversation')
    participant_a   = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='conversations_as_a')
    participant_b   = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='conversations_as_b')
    topic           = models.CharField(max_length=30, choices=TOPIC_CHOICES, default='networking')
    custom_topic    = models.CharField(max_length=100, blank=True)
    muted_by_a      = models.BooleanField(default=False)
    muted_by_b      = models.BooleanField(default=False)
    created_at      = models.DateTimeField(auto_now_add=True)
    last_message_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-last_message_at', '-created_at']

    def __str__(self):
        return f"{self.participant_a.email} ↔ {self.participant_b.email}"

    @property
    def topic_display(self):
        if self.topic == 'other' and self.custom_topic:
            return self.custom_topic
        return dict(TOPIC_CHOICES).get(self.topic, self.topic)

    def other_participant(self, user):
        return self.participant_b if self.participant_a == user else self.participant_a

    def is_muted_by(self, user):
        if self.participant_a == user:
            return self.muted_by_a
        return self.muted_by_b

    def unread_count_for(self, user):
        return self.messages.filter(read=False).exclude(sender=user).count()


class Message(models.Model):
    MESSAGE_TYPE_CHOICES = [
        ('text',  'Text'),
        ('image', 'Image'),
    ]

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    sender       = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='chat_messages')
    content      = models.TextField(blank=True)
    image        = models.ImageField(upload_to='chat/images/', blank=True, null=True)
    message_type = models.CharField(max_length=10, choices=MESSAGE_TYPE_CHOICES, default='text')
    reply_to     = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='replies')
    delivered    = models.BooleanField(default=True)
    read         = models.BooleanField(default=False)
    read_at      = models.DateTimeField(null=True, blank=True)
    is_deleted   = models.BooleanField(default=False)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.sender.email}: {self.content[:40] or '[image]'}"


class MessageReaction(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    message    = models.ForeignKey(Message, on_delete=models.CASCADE, related_name='reactions')
    user       = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='chat_reactions')
    reaction   = models.CharField(max_length=15, choices=REACTION_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['message', 'user']
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.email} → {self.reaction} on {self.message_id}"


class MessageReport(models.Model):
    REASON_CHOICES = [
        ('spam',       'Spam'),
        ('harassment', 'Harassment'),
        ('offensive',  'Offensive Content'),
        ('other',      'Other'),
    ]

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    message    = models.ForeignKey(Message, on_delete=models.CASCADE, related_name='reports')
    reporter   = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='message_reports')
    reason     = models.CharField(max_length=15, choices=REASON_CHOICES, default='other')
    detail     = models.TextField(blank=True)
    reviewed   = models.BooleanField(default=False)
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='reviewed_reports')
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Report by {self.reporter.email} on msg {self.message_id}"


class ShakeLog(models.Model):
    """Logs every shake event and successful shake-connect."""
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user       = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='shake_logs')
    event_type = models.CharField(max_length=20, choices=[('shake', 'Shake'), ('connect', 'Connected')])
    partner    = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='shake_partner_logs')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes  = [models.Index(fields=['-created_at'])]

    def __str__(self):
        return f"{self.user} — {self.event_type} — {self.created_at:%H:%M:%S}"
