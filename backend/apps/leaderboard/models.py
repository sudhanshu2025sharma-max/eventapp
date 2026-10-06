from django.db import models
from django.conf import settings


class PointAction(models.TextChoices):
    SIGNUP             = 'signup',             'Account Created'
    CHECKIN            = 'checkin',            'Check-in'
    MEAL               = 'meal',               'Meal Check-in'
    POLL_VOTE          = 'poll_vote',          'Poll Vote'
    PHOTO_UPLOAD       = 'photo_upload',       'Photo Upload'
    PROFILE_COMPLETION = 'profile_completion', 'Profile Completion'
    FEEDBACK           = 'feedback',           'Session Feedback'
    NETWORKING         = 'networking',         'Connection Made'
    DAILY_LOGIN        = 'daily_login',        'Daily Login Bonus'


POINT_VALUES = {
    PointAction.SIGNUP:             10,
    PointAction.CHECKIN:            20,
    PointAction.MEAL:               10,
    PointAction.POLL_VOTE:          20,
    PointAction.PHOTO_UPLOAD:       15,
    PointAction.PROFILE_COMPLETION: 50,
    PointAction.FEEDBACK:           25,
    PointAction.NETWORKING:         15,
    PointAction.DAILY_LOGIN:        10,
}


class PointEntry(models.Model):
    user       = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='point_entries')
    action     = models.CharField(max_length=30, choices=PointAction.choices)
    points     = models.PositiveIntegerField()
    note       = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'point_entries'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.email} +{self.points} ({self.action})"


class UserPoints(models.Model):
    """
    Denormalised total for fast reads. One row per user.
    Updated via award_points() helper — no signals, no magic.
    """
    user         = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='points_summary')
    total_points = models.PositiveIntegerField(default=0)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'user_points'
        ordering = ['-total_points', 'updated_at']

    def __str__(self):
        return f"{self.user.email}: {self.total_points}pts"

    @property
    def rank(self):
        """
        1-based rank among checked-in participants only.
        Ties are broken sequentially by:
          1. More points
          2. Earlier point update timestamp (updated_at)
          3. Deterministic user_id sorting fallback
        """
        if self.user.role != 'participant':
            return 0

        from apps.checkins.models import CheckIn

        eligible = CheckIn.objects.filter(user=self.user, checkin_type='conference').exists()
        if not eligible:
            return 0

        checked_in_user_ids = list(CheckIn.objects.filter(
            checkin_type='conference'
        ).values_list('user_id', flat=True))

        better_count = UserPoints.objects.filter(
            user__role='participant',
            user_id__in=checked_in_user_ids,
        ).filter(
            models.Q(total_points__gt=self.total_points) |
            models.Q(total_points=self.total_points, updated_at__lt=self.updated_at) |
            models.Q(total_points=self.total_points, updated_at=self.updated_at, user_id__lt=self.user_id)
        ).count()

        return better_count + 1
