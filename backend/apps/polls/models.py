import uuid
from django.db import models
from django.conf import settings


class Poll(models.Model):
    class Type(models.TextChoices):
        SINGLE   = 'single',   'Single Choice'
        MULTIPLE = 'multiple', 'Multiple Choice'
        YESNO    = 'yesno',    'Yes / No'
        RATING   = 'rating',   'Rating (1–5)'

    class Status(models.TextChoices):
        DRAFT     = 'draft',     'Draft'
        SCHEDULED = 'scheduled', 'Scheduled'
        LIVE      = 'live',      'Live'
        CLOSED    = 'closed',    'Closed'

    class ResultVis(models.TextChoices):
        LIVE   = 'live',   'Show while voting'
        AFTER  = 'after',  'Show after closing'
        HIDDEN = 'hidden', 'Always hidden'

    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title          = models.CharField(max_length=200)
    question       = models.TextField()
    description    = models.TextField(blank=True)
    poll_type      = models.CharField(max_length=20, choices=Type.choices, default=Type.SINGLE)
    status         = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    result_vis     = models.CharField(max_length=20, choices=ResultVis.choices, default=ResultVis.AFTER)

    # Ideathon
    is_ideathon    = models.BooleanField(default=False)

    # Timing
    starts_at      = models.DateTimeField(null=True, blank=True)
    ends_at        = models.DateTimeField(null=True, blank=True)

    # Session link (optional)
    session        = models.ForeignKey(
        'schedule.ScheduleSession', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='polls'
    )

    # Multiple-choice cap (0 = unlimited within options)
    max_choices    = models.PositiveSmallIntegerField(default=1)

    # Points
    award_points   = models.BooleanField(default=True)

    created_by     = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True,
        on_delete=models.SET_NULL, related_name='created_polls'
    )
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.status}] {self.title}"

    @property
    def is_open(self):
        """Server-authoritative: poll is currently accepting votes."""
        from django.utils import timezone
        if self.status != 'live':
            return False
        now = timezone.now()
        if self.ends_at and now > self.ends_at:
            return False
        return True

    @property
    def total_votes(self):
        return Vote.objects.filter(poll=self).count()

    def results(self):
        """Returns list of {option_id, text, votes, pct} sorted by votes desc."""
        opts = self.options.all()
        total = self.total_votes
        out = []
        for opt in opts:
            cnt = Vote.objects.filter(option=opt).count()
            out.append({
                'id': str(opt.id),
                'text': opt.text,
                'order': opt.order,
                'votes': cnt,
                'pct': round(cnt * 100 / total, 1) if total else 0,
            })
        return sorted(out, key=lambda x: -x['votes'])


class PollOption(models.Model):
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    poll         = models.ForeignKey(Poll, on_delete=models.CASCADE, related_name='options')
    text         = models.CharField(max_length=300)
    order        = models.PositiveSmallIntegerField(default=0)
    # Ideathon team fields (all optional)
    team_name    = models.CharField(max_length=200, blank=True)
    team_members = models.CharField(max_length=500, blank=True, help_text='Comma-separated names')
    project_title= models.CharField(max_length=300, blank=True)
    project_desc = models.TextField(blank=True)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return f"{self.poll.title} → {self.text}"


class Vote(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    poll       = models.ForeignKey(Poll, on_delete=models.CASCADE, related_name='votes')
    option     = models.ForeignKey(PollOption, on_delete=models.CASCADE, related_name='votes')
    user       = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='poll_votes')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # DB-level guarantee: one vote per user per poll
        unique_together = [('poll', 'user')]

    def __str__(self):
        return f"{self.user.email} → {self.poll.title} → {self.option.text}"


class PollAuditLog(models.Model):
    poll       = models.ForeignKey(Poll, on_delete=models.CASCADE, related_name='audit_logs')
    admin      = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    action     = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.poll.title} — {self.action}"

# Import ideathon models so they share the same app and migrations
from .ideathon_models import IdeathonConfig, IdeathonTeam, IdeathonMember, IdeathonInvite, AVATAR_CHOICES
