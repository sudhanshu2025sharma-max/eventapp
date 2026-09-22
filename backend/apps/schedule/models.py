from django.db import models
from apps.accounts.models import User
from datetime import datetime, date, time
import uuid

class SESSION_TYPE(models.TextChoices):
    KEYNOTE = 'keynote', 'Keynote'
    TECHNICAL = 'technical', 'Technical Session'
    WORKSHOP = 'workshop', 'Workshop'
    BREAK = 'break', 'Break'
    MEAL = 'meal', 'Meal'
    CULTURAL = 'cultural', 'Cultural Event'
    PANEL = 'panel', 'Panel Discussion'
    SPECIAL = 'special', 'Special Session'
    IDEATHON = 'ideathon', 'Ideathon'
    CEREMONY = 'ceremony', 'Ceremony'

SESSION_TYPES = SESSION_TYPE.choices

class ScheduleSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    day = models.IntegerField(default=1)
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    title = models.CharField(max_length=255)
    session_type = models.CharField(max_length=20, choices=SESSION_TYPE.choices, default=SESSION_TYPE.TECHNICAL)
    room = models.CharField(max_length=100, blank=True, null=True)
    chair = models.CharField(max_length=255, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    display_order = models.IntegerField(default=0)
    is_featured = models.BooleanField(default=False)
    is_parallel = models.BooleanField(default=False)
    is_published = models.BooleanField(default=True)
    status = models.CharField(max_length=20, default='published')
    is_meal = models.BooleanField(default=False)
    meal_category = models.CharField(max_length=50, default='Lunch', blank=True)
    feedback_enabled = models.BooleanField(default=True)
    feedback_auto_open = models.BooleanField(default=False)
    notify_featured_60_sent_at = models.DateTimeField(null=True, blank=True)
    notify_all_5_sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['date', 'start_time', 'display_order']

    @property
    def start_datetime(self):
        if self.date and self.start_time:
            return datetime.combine(self.date, self.start_time)
        return None

    @start_datetime.setter
    def start_datetime(self, val):
        if not val: return
        if isinstance(val, str):
            val = val.strip()
            for fmt in ('%Y-%m-%dT%H:%M', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M'):
                try:
                    dt = datetime.strptime(val[:16], fmt)
                    self.date = dt.date()
                    self.start_time = dt.time()
                    return
                except ValueError: pass
        elif isinstance(val, datetime):
            self.date = val.date()
            self.start_time = val.time()

    @property
    def end_datetime(self):
        if self.date and self.end_time:
            return datetime.combine(self.date, self.end_time)
        return None

    @end_datetime.setter
    def end_datetime(self, val):
        if not val: return
        if isinstance(val, str):
            val = val.strip()
            for fmt in ('%Y-%m-%dT%H:%M', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M'):
                try:
                    dt = datetime.strptime(val[:16], fmt)
                    self.end_time = dt.time()
                    return
                except ValueError: pass
        elif isinstance(val, datetime):
            self.end_time = val.time()

    @property
    def start_datetime_iso(self):
        if self.date and self.start_time:
            return f"{self.date.strftime('%Y-%m-%d')}T{self.start_time.strftime('%H:%M')}"
        return ""

    @property
    def end_datetime_iso(self):
        if self.date and self.end_time:
            return f"{self.date.strftime('%Y-%m-%d')}T{self.end_time.strftime('%H:%M')}"
        return ""

    @property
    def time_display(self):
        if self.start_time and self.end_time:
            return f"{self.start_time.strftime('%I:%M %p')} - {self.end_time.strftime('%I:%M %p')}"
        elif self.start_time:
            return self.start_time.strftime('%I:%M %p')
        return "-"

    @property
    def subsessions(self):
        return self.sub_sessions.all()

    def __str__(self):
        return f"{self.title} ({self.date} {self.start_time})"


class ScheduleSubSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(ScheduleSession, on_delete=models.CASCADE, related_name='sub_sessions')
    title = models.CharField(max_length=255)
    speaker_name = models.CharField(max_length=255, blank=True, null=True)
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)

    class Meta:
        ordering = ['start_time']


class AcceptedPaper(models.Model):
    PAPER_TYPES = (('paper', 'Paper'), ('poster', 'Poster'))
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(ScheduleSession, on_delete=models.CASCADE, related_name='papers', null=True, blank=True)
    paper_id = models.CharField(max_length=50, blank=True, null=True)
    paper_type = models.CharField(max_length=20, choices=PAPER_TYPES, default='paper')
    title = models.TextField()
    authors = models.TextField()
    abstract = models.TextField(blank=True, null=True)
    track = models.CharField(max_length=100, blank=True, null=True)
    slot_start = models.TimeField(null=True, blank=True)
    slot_end = models.TimeField(null=True, blank=True)
    slot_order = models.IntegerField(default=0)
    pdf_url = models.URLField(max_length=500, blank=True, null=True)
    document = models.FileField(upload_to='papers/', blank=True, null=True)
    is_published = models.BooleanField(default=True)

    class Meta:
        ordering = ['slot_start', 'slot_order']

    def __str__(self):
        return f"{self.paper_id or 'Paper'}: {self.title[:40]}"


class SessionBookmark(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    session = models.ForeignKey(ScheduleSession, on_delete=models.CASCADE)
    reminder_minutes = models.IntegerField(default=5)
    reminder_sent = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'session')


class FeedbackForm(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(ScheduleSession, on_delete=models.CASCADE, related_name='feedback_forms', null=True, blank=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class FeedbackQuestion(models.Model):
    QUESTION_TYPES = (
        ('rating', 'Rating (1-5)'),
        ('text', 'Text Response'),
        ('choice', 'Multiple Choice'),
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    form = models.ForeignKey(FeedbackForm, on_delete=models.CASCADE, related_name='questions')
    question_text = models.TextField()
    question_type = models.CharField(max_length=20, choices=QUESTION_TYPES, default='rating')
    options = models.JSONField(blank=True, null=True)
    is_required = models.BooleanField(default=True)
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ['order']


class FeedbackResponse(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    form = models.ForeignKey(FeedbackForm, on_delete=models.CASCADE, related_name='responses')
    session = models.ForeignKey(ScheduleSession, on_delete=models.CASCADE, related_name='feedback_responses', null=True, blank=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    answers = models.JSONField(default=dict)
    submitted_at = models.DateTimeField(auto_now_add=True)


class FeedbackAnswer(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    response = models.ForeignKey(FeedbackResponse, on_delete=models.CASCADE, related_name='answers_list')
    question = models.ForeignKey(FeedbackQuestion, on_delete=models.CASCADE)
    answer_text = models.TextField(blank=True, null=True)
    rating_value = models.IntegerField(blank=True, null=True)


class PaperBookmark(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    paper = models.ForeignKey(AcceptedPaper, on_delete=models.CASCADE, related_name='bookmarks')
    reminder_minutes = models.IntegerField(default=5)
    reminder_sent = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'paper')
