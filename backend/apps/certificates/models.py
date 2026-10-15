import uuid
from django.db import models
from apps.accounts.models import User


class CertificateConfig(models.Model):
    """Singleton — configurable issuing authority (not hardcoded)."""
    authority_name = models.CharField(max_length=200, default='Central Library, IIT Delhi')
    authority_title = models.CharField(max_length=200, default='Head, Central Library')
    organization = models.CharField(max_length=200, default='Indian Institute of Technology Delhi')
    email_subject = models.CharField(max_length=300, default='Your ETD 2026 Certificate')
    email_body = models.TextField(
        default='Dear {name},\n\nPlease find attached your certificate.\n\nRegards,\nCentral Library, IIT Delhi'
    )

    class Meta:
        verbose_name = 'Certificate Settings'

    def __str__(self):
        return self.authority_name

    @classmethod
    def get(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)


class CertificateTemplate(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    bg_image = models.ImageField(upload_to='cert_templates/')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title


class CertificateField(models.Model):
    DATA_SOURCE_CHOICES = [
        ('user.full_name', 'Recipient Full Name'),
        ('user.designation', 'Recipient Designation'),
        ('user.affiliation', 'Recipient Affiliation / Institute'),
        ('user.email', 'Recipient Email'),
        ('speaker.paper_title', 'Speaker — Paper Title'),
        ('speaker.session_name', 'Speaker — Session Name'),
        ('event.name', 'Event Name (ETD 2026)'),
        ('event.date', 'Event Date Range'),
        ('event.venue', 'Event Venue'),
        ('date.today', 'Current Date (auto)'),
        ('custom', 'Custom Fixed Text'),
    ]

    template = models.ForeignKey(CertificateTemplate, related_name='fields', on_delete=models.CASCADE)
    field_key = models.CharField(max_length=50, help_text='Internal key, e.g. "name"')
    label = models.CharField(max_length=100, help_text='Admin display label')
    data_source = models.CharField(max_length=50, choices=DATA_SOURCE_CHOICES)
    custom_text = models.CharField(max_length=500, blank=True, help_text='Only used when data_source = custom')
    x = models.IntegerField(help_text='Pixel X on the original Canva image')
    y = models.IntegerField(help_text='Pixel Y on the original Canva image')
    font_size = models.IntegerField(default=42, help_text='Maximum font size in pixels')
    min_font_size = models.IntegerField(default=18, help_text='Minimum font size (auto-shrink limit)')
    font_color = models.CharField(max_length=7, default='#1a1a1a', help_text='Hex color')
    max_width = models.IntegerField(default=0, help_text='0 = no limit. >0 = auto-shrink + wrap within this pixel width')
    text_align = models.CharField(max_length=10, default='center', choices=[('left', 'Left'), ('center', 'Center'), ('right', 'Right')])
    is_bold = models.BooleanField(default=False)
    font_family = models.CharField(
        max_length=80, default='DejaVuSans',
        help_text='Font file key used by generator'
    )
    line_height = models.FloatField(default=1.3, help_text='Line spacing multiplier for wrapped text')

    def __str__(self):
        return f"{self.label} ({self.data_source})"


class IssuedCertificate(models.Model):
    template = models.ForeignKey(CertificateTemplate, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    generated_pdf = models.FileField(upload_to='certificates/%Y/%m/')
    issued_at = models.DateTimeField(auto_now_add=True)
    issued_by_name = models.CharField(max_length=200, blank=True)

    class Meta:
        unique_together = ('template', 'user')
        ordering = ['-issued_at']

    def __str__(self):
        return f"{self.template.title} → {self.user.email}"


class CertificateBatchJob(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('running', 'Running'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    template = models.ForeignKey(CertificateTemplate, on_delete=models.CASCADE)
    total_count = models.IntegerField(default=0)
    completed_count = models.IntegerField(default=0)
    failed_count = models.IntegerField(default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    send_push = models.BooleanField(default=True)
    send_email = models.BooleanField(default=False)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='cert_jobs')
    created_at = models.DateTimeField(auto_now_add=True)
    error_log = models.TextField(blank=True)

    def __str__(self):
        return f"Batch #{self.pk} — {self.template.title} ({self.status})"
