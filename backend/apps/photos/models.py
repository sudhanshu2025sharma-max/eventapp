from django.db import models
from django.conf import settings
from apps.schedule.models import ScheduleSession


class PhotoSettings(models.Model):
    upload_open        = models.BooleanField(default=False)
    selfie_upload_open = models.BooleanField(default=True)
    auto_approve       = models.BooleanField(default=False)
    updated_at         = models.DateTimeField(auto_now=True)
    updated_by         = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+',
    )

    class Meta:
        db_table = 'photo_settings'

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def get(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class Photo(models.Model):
    class Status(models.TextChoices):
        PENDING  = 'pending',  'Pending'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'

    uploader    = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='photos')
    image       = models.ImageField(upload_to='photos/%Y/%m/')
    caption     = models.CharField(max_length=300, blank=True)
    session     = models.ForeignKey(ScheduleSession, null=True, blank=True, on_delete=models.SET_NULL, related_name='photos')
    status      = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING, db_index=True)
    rejected_reason = models.CharField(max_length=200, blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='reviewed_photos')

    class Meta:
        db_table = 'photos'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.uploader.email} — {self.status}"


class SelfiePoint(models.Model):
    CHECKPOINT_TYPES = [
        ('selfie', 'Selfie Checkpoint'),
        ('sponsor_zone', 'Sponsor Zone'),
    ]

    name                = models.CharField(max_length=200)
    description         = models.TextField(blank=True, default='')
    checkpoint_type     = models.CharField(max_length=20, choices=CHECKPOINT_TYPES, default='selfie')
    latitude            = models.DecimalField(max_digits=12, decimal_places=8, null=True, blank=True)
    longitude           = models.DecimalField(max_digits=12, decimal_places=8, null=True, blank=True)
    radius_meters       = models.PositiveIntegerField(default=20)
    point_a_lat         = models.DecimalField(max_digits=12, decimal_places=8, null=True, blank=True)
    point_a_lng         = models.DecimalField(max_digits=12, decimal_places=8, null=True, blank=True)
    point_b_lat         = models.DecimalField(max_digits=12, decimal_places=8, null=True, blank=True)
    point_b_lng         = models.DecimalField(max_digits=12, decimal_places=8, null=True, blank=True)
    corridor_width_meters = models.PositiveIntegerField(default=30)
    points              = models.PositiveIntegerField(default=10)
    sample_photo        = models.ImageField(upload_to='selfie_points/samples/', blank=True, null=True)
    is_active           = models.BooleanField(default=True)
    created_at          = models.DateTimeField(auto_now_add=True)
    sponsors            = models.ManyToManyField('sponsors.Sponsor', blank=True, related_name='checkpoint_zones')

    class Meta:
        db_table = 'selfie_points'
        ordering = ['name']

    def __str__(self):
        type_label = '📸' if self.checkpoint_type == 'selfie' else '🏢'
        return f"{type_label} {self.name} ({self.checkpoint_type})"


class SelfiePointImage(models.Model):
    """Multiple reference images per checkpoint (selfie or sponsor zone)."""
    selfie_point = models.ForeignKey(SelfiePoint, on_delete=models.CASCADE, related_name='images')
    image        = models.ImageField(upload_to='selfie_points/samples/')
    order        = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'selfie_point_images'
        ordering = ['order']

    def __str__(self):
        return f"Image {self.order} for {self.selfie_point.name}"


class SelfieSubmission(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending Review'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    user                 = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='selfie_submissions')
    selfie_point         = models.ForeignKey(SelfiePoint, on_delete=models.CASCADE, related_name='submissions')
    photo                = models.ImageField(upload_to='selfie_submissions/%Y/%m/', blank=True, null=True)
    user_latitude        = models.DecimalField(max_digits=12, decimal_places=8)
    user_longitude       = models.DecimalField(max_digits=12, decimal_places=8)
    distance_meters      = models.FloatField()
    verified_in_geofence = models.BooleanField(default=False)
    status               = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending', db_index=True)
    points_awarded       = models.PositiveIntegerField(default=0)
    rejected_reason      = models.CharField(max_length=200, blank=True)
    reviewed_at          = models.DateTimeField(null=True, blank=True)
    reviewed_by          = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='reviewed_submissions')
    created_at           = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'selfie_submissions'
        ordering = ['-created_at']
        unique_together = ['user', 'selfie_point']

    def __str__(self):
        return f"{self.user.email} → {self.selfie_point.name} [{self.status}]"
