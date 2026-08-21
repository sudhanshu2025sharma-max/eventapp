import uuid
from django.db import models
from django.conf import settings


class IdeathonConfig(models.Model):
    registration_open = models.BooleanField(default=False)
    reg_starts_at     = models.DateTimeField(null=True, blank=True)
    reg_ends_at       = models.DateTimeField(null=True, blank=True)
    min_team_size     = models.PositiveSmallIntegerField(default=2)
    max_team_size     = models.PositiveSmallIntegerField(default=5)
    description       = models.TextField(blank=True, default='Build. Collaborate. Innovate. Transform Libraries.')
    updated_by        = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    updated_at        = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Ideathon Config'

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def get(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    @property
    def is_open(self):
        if not self.registration_open:
            return False
        from django.utils import timezone
        now = timezone.now()
        if self.reg_starts_at and now < self.reg_starts_at:
            return False
        if self.reg_ends_at and now > self.reg_ends_at:
            return False
        return True

    def __str__(self):
        return f"Ideathon Config (open={self.registration_open})"


AVATAR_CHOICES = [
    ('rocket',    '🚀 Rocket'),
    ('bulb',      '💡 Bulb'),
    ('fire',      '🔥 Fire'),
    ('star',      '⭐ Star'),
    ('brain',     '🧠 Brain'),
    ('lightning', '⚡ Lightning'),
    ('diamond',   '💎 Diamond'),
    ('trophy',    '🏆 Trophy'),
    ('compass',   '🧭 Compass'),
    ('atom',      '⚛️ Atom'),
]


class IdeathonTeam(models.Model):
    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name           = models.CharField(max_length=200, unique=True)
    avatar         = models.CharField(max_length=20, choices=AVATAR_CHOICES, default='rocket')
    project_title  = models.CharField(max_length=300, blank=True)
    project_desc   = models.TextField(blank=True)
    leader         = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='led_teams',
    )
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name

    @property
    def member_count(self):
        return self.members.count()

    @property
    def member_names(self):
        return ', '.join(
            m.user.get_full_name() or m.user.email.split('@')[0]
            for m in self.members.select_related('user').all()
        )


class IdeathonMember(models.Model):
    team      = models.ForeignKey(IdeathonTeam, on_delete=models.CASCADE, related_name='members')
    user      = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='ideathon_membership',
    )
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('team', 'user')]

    def __str__(self):
        return f"{self.user.get_full_name()} → {self.team.name}"


class IdeathonInvite(models.Model):
    class Status(models.TextChoices):
        PENDING  = 'pending',  'Pending'
        ACCEPTED = 'accepted', 'Accepted'
        DECLINED = 'declined', 'Declined'

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    team       = models.ForeignKey(IdeathonTeam, on_delete=models.CASCADE, related_name='invites')
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='sent_ideathon_invites',
    )
    invitee    = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='ideathon_invites',
    )
    status     = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # One pending invite per person per team
        unique_together = [('team', 'invitee')]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.invitee.get_full_name()} → {self.team.name} [{self.status}]"
