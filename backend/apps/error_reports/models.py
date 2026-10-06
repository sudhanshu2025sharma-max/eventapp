from django.db import models
from django.conf import settings
import uuid


class ErrorReport(models.Model):
    CATEGORY_CHOICES = [
        ('ui_ux',         'App UI / Screen Glitch'),
        ('backend_api',   'Backend / API Error'),
        ('notification',  'Push Notifications Issue'),
        ('network',       'Network / Connectivity'),
        ('auth',          'Login & Account Issue'),
        ('schedule_meal', 'Schedule / Meal Scanner Issue'),
        ('other',         'Other Service / Linux Issue'),
    ]

    STATUS_CHOICES = [
        ('new',         'New'),
        ('in_progress', 'In Progress'),
        ('resolved',    'Resolved'),
        ('closed',      'Closed'),
    ]

    SEVERITY_CHOICES = [
        ('low',      'Low'),
        ('medium',   'Medium'),
        ('high',     'High'),
        ('critical', 'Critical'),
    ]

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user         = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reported_errors'
    )
    user_email   = models.EmailField(blank=True)
    user_name    = models.CharField(max_length=150, blank=True)
    user_phone   = models.CharField(max_length=30, blank=True)
    category     = models.CharField(max_length=30, choices=CATEGORY_CHOICES, default='ui_ux')
    title        = models.CharField(max_length=255, blank=True)
    description  = models.TextField()
    device_info  = models.JSONField(default=dict, blank=True)
    status       = models.CharField(max_length=20, choices=STATUS_CHOICES, default='new')
    severity     = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default='medium')
    admin_notes  = models.TextField(blank=True)
    resolved_by  = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='resolved_errors'
    )
    resolved_at  = models.DateTimeField(null=True, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.get_category_display()}] {self.user_email or 'Anonymous'} - {self.status}"


class ErrorReportScreenshot(models.Model):
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    report      = models.ForeignKey(ErrorReport, on_delete=models.CASCADE, related_name='screenshots')
    image       = models.ImageField(upload_to='error_reports/%Y/%m/')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Screenshot for Report {self.report.id}"


class SystemLogEntry(models.Model):
    LOG_TYPE_CHOICES = [
        ('backend_5xx',    'Backend 500 Exception'),
        ('push_failure',   'Push Notification Failure'),
        ('auth_failure',   'Failed Login / Auth Issue'),
        ('system_health',  'System / Service Warning'),
        ('cron_watchdog',  'Cron Watchdog Event'),
    ]

    LEVEL_CHOICES = [
        ('INFO',     'Info'),
        ('WARNING',  'Warning'),
        ('ERROR',    'Error'),
        ('CRITICAL', 'Critical'),
    ]

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    log_type     = models.CharField(max_length=30, choices=LOG_TYPE_CHOICES, default='backend_5xx')
    level        = models.CharField(max_length=15, choices=LEVEL_CHOICES, default='ERROR')
    message      = models.TextField()
    traceback    = models.TextField(blank=True)
    path         = models.CharField(max_length=255, blank=True)
    method       = models.CharField(max_length=10, blank=True)
    ip_address   = models.GenericIPAddressField(null=True, blank=True)
    user_email   = models.EmailField(blank=True)
    context_data = models.JSONField(default=dict, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.level}] {self.get_log_type_display()}: {self.message[:60]}"
