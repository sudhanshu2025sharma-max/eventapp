from django.db import models


class Speaker(models.Model):

    user = models.OneToOneField(
    'accounts.User',
    on_delete=models.SET_NULL,
    null=True,
    blank=True,
    related_name='speaker_profile',
    help_text='Link to user account for chat/login'
    )
    
    TITLE_CHOICES = [
        ('prof', 'Prof.'),
        ('dr',   'Dr.'),
        ('mr',   'Mr.'),
        ('ms',   'Ms.'),
        ('',     '(none)'),
    ]

    # Core identity
    title          = models.CharField(max_length=10, choices=TITLE_CHOICES, blank=True, default='')
    first_name     = models.CharField(max_length=100)
    last_name      = models.CharField(max_length=100)
    designation    = models.CharField(max_length=200, blank=True)
    institute      = models.CharField(max_length=300, blank=True)
    country        = models.CharField(max_length=100, blank=True)
    bio            = models.TextField(blank=True)
    photo          = models.ImageField(upload_to='speakers/photos/', blank=True, null=True)

    # Social / contact
    email              = models.EmailField(blank=True)
    website_url        = models.URLField(blank=True)
    linkedin_url       = models.URLField(blank=True)
    google_scholar_url = models.URLField(blank=True)
    researchgate_url   = models.URLField(blank=True)
    twitter_url        = models.URLField(blank=True)

    # Flags
    is_keynote   = models.BooleanField(default=False)
    is_active    = models.BooleanField(default=True)
    display_order = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['display_order', 'last_name', 'first_name']

    def __str__(self):
        title = self.get_title_display() if self.title else ''
        return f"{title} {self.first_name} {self.last_name}".strip()

    @property
    def full_name(self):
        title = self.get_title_display() if self.title else ''
        return f"{title} {self.first_name} {self.last_name}".strip()

    @property
    def initials(self):
        parts = []
        if self.first_name:
            parts.append(self.first_name[0].upper())
        if self.last_name:
            parts.append(self.last_name[0].upper())
        return ''.join(parts) or '?'

    @property
    def photo_url(self):
        if self.photo:
            return self.photo.url
        return None


class SpeakerTalk(models.Model):
    """A speaker can have multiple talk entries added by admin."""
    speaker  = models.ForeignKey(Speaker, on_delete=models.CASCADE, related_name='talks')
    title    = models.CharField(max_length=400)
    abstract = models.TextField(blank=True)
    track    = models.CharField(max_length=200, blank=True)  # e.g. "Keynote", "Workshop A"
    talk_date = models.DateField(blank=True, null=True)
    talk_time = models.CharField(max_length=20, blank=True)  # e.g. "10:00 AM"
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['display_order', 'talk_date', 'talk_time']

    def __str__(self):
        return f"{self.speaker} — {self.title}"
