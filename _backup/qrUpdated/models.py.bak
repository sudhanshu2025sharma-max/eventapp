from django.db import models
from django.conf import settings
import uuid


class CheckIn(models.Model):
    GOODIES_CHOICES = [
        ('pending',  'Pending'),
        ('received', 'Received'),
        ('skipped',  'Skipped'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='checkins'
    )
    checkin_type = models.CharField(max_length=20, default='conference')
    scanned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='scanned_checkins'
    )
    scanned_at = models.DateTimeField(auto_now_add=True)
    notes = models.CharField(max_length=200, blank=True)

    goodies_status = models.CharField(max_length=20, choices=GOODIES_CHOICES, default='pending')
    goodies_note = models.TextField(blank=True)
    goodies_confirmed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='goodies_confirmed'
    )
    goodies_confirmed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'checkins'
        unique_together = ['user', 'checkin_type']
        ordering = ['-scanned_at']

    def __str__(self):
        return f"{self.user.email} — {self.checkin_type} @ {self.scanned_at:%Y-%m-%d %H:%M}"


class MealPass(models.Model):
    # unified (default) + legacy lunch/dinner kept
    MEAL_CHOICES = [('meal', 'Meal'), ('lunch', 'Lunch'), ('dinner', 'Dinner')]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='meal_passes', null=True, blank=True
    )
    meal_type = models.CharField(max_length=20, choices=MEAL_CHOICES, default='meal')
    date = models.DateField()
    is_active = models.BooleanField(default=True)
    used = models.BooleanField(default=False)
    used_at = models.DateTimeField(null=True, blank=True)
    scanned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='meal_scans'
    )

    # Walk-in fields (when user is NULL)
    guest_name = models.CharField(max_length=200, blank=True)
    guest_email = models.EmailField(blank=True)
    guest_phone = models.CharField(max_length=20, blank=True)
    guest_reg_no = models.CharField(max_length=50, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'meal_passes'
        ordering = ['-created_at']

    def __str__(self):
        who = self.user.email if self.user else (self.guest_name or 'Guest')
        return f"{who} — {self.meal_type} {self.date}"

    @property
    def display_name(self):
        if self.user:
            return self.user.get_full_name() or self.user.email
        return self.guest_name or 'Guest'

    @property
    def display_email(self):
        return self.user.email if self.user else (self.guest_email or '')

    @property
    def display_reg(self):
        return self.user.registration_id if self.user else (self.guest_reg_no or '')


class MealWindow(models.Model):
    MEAL_CHOICES = [('meal', 'Meal'), ('lunch', 'Lunch'), ('dinner', 'Dinner')]

    meal_type = models.CharField(max_length=20, choices=MEAL_CHOICES, default='meal')
    date = models.DateField()

    # schedule
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)

    # push schedule offsets (minutes before)
    notify_open_minutes_before = models.PositiveIntegerField(default=15)
    notify_close_minutes_before = models.PositiveIntegerField(default=10)

    # state
    is_open = models.BooleanField(default=False)
    opened_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name='meal_windows_opened'
    )
    opened_at = models.DateTimeField(auto_now_add=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    # one-shot flags
    notified_opening = models.BooleanField(default=False)  # used for "opens in X minutes" OR "open now"
    notified_closing = models.BooleanField(default=False)  # used for "closes in X minutes" OR "closed"

    class Meta:
        db_table = 'meal_windows'
        unique_together = ['meal_type', 'date']
        ordering = ['-date', 'start_time']

    def __str__(self):
        t = f"{self.start_time}-{self.end_time}" if self.start_time and self.end_time else "unscheduled"
        return f"{self.meal_type} {self.date} {t} — {'open' if self.is_open else 'closed'}"
