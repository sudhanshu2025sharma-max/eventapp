# Generated manually to restore schedule migration dependency graph
import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ScheduleSession',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('title', models.CharField(max_length=255)),
                ('session_type', models.CharField(choices=[('keynote', 'Keynote'), ('technical', 'Technical Session'), ('workshop', 'Workshop'), ('break', 'Break'), ('meal', 'Meal'), ('cultural', 'Cultural Event'), ('panel', 'Panel Discussion'), ('special', 'Special Session'), ('ideathon', 'Ideathon'), ('ceremony', 'Ceremony')], default='technical', max_length=20)),
                ('date', models.DateField()),
                ('start_time', models.TimeField()),
                ('end_time', models.TimeField()),
                ('room', models.CharField(blank=True, max_length=100, null=True)),
                ('chair', models.CharField(blank=True, max_length=255, null=True)),
                ('description', models.TextField(blank=True, null=True)),
                ('display_order', models.IntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'ordering': ['date', 'start_time', 'display_order'],
            },
        ),
        migrations.CreateModel(
            name='ScheduleSubSession',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('title', models.CharField(max_length=255)),
                ('speaker_name', models.CharField(blank=True, max_length=255, null=True)),
                ('start_time', models.TimeField(blank=True, null=True)),
                ('end_time', models.TimeField(blank=True, null=True)),
                ('session', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='subsessions', to='schedule.schedulesession')),
            ],
            options={
                'ordering': ['start_time'],
            },
        ),
        migrations.CreateModel(
            name='AcceptedPaper',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('paper_id', models.CharField(blank=True, max_length=50, null=True)),
                ('paper_type', models.CharField(choices=[('paper', 'Paper'), ('poster', 'Poster')], default='paper', max_length=20)),
                ('title', models.TextField()),
                ('authors', models.TextField()),
                ('abstract', models.TextField(blank=True, null=True)),
                ('track', models.CharField(blank=True, max_length=100, null=True)),
                ('slot_start', models.TimeField(blank=True, null=True)),
                ('slot_end', models.TimeField(blank=True, null=True)),
                ('slot_order', models.IntegerField(default=0)),
                ('pdf_url', models.URLField(blank=True, max_length=500, null=True)),
                ('document', models.FileField(blank=True, null=True, upload_to='papers/')),
                ('is_published', models.BooleanField(default=True)),
                ('session', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='papers', to='schedule.schedulesession')),
            ],
            options={
                'ordering': ['slot_start', 'slot_order'],
            },
        ),
        migrations.CreateModel(
            name='FeedbackForm',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('title', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True, null=True)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('session', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='feedback_forms', to='schedule.schedulesession')),
            ],
        ),
        migrations.CreateModel(
            name='FeedbackQuestion',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('question_text', models.TextField()),
                ('question_type', models.CharField(choices=[('rating', 'Rating (1-5)'), ('text', 'Text Response'), ('choice', 'Multiple Choice')], default='rating', max_length=20)),
                ('options', models.JSONField(blank=True, null=True)),
                ('is_required', models.BooleanField(default=True)),
                ('order', models.IntegerField(default=0)),
                ('form', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='questions', to='schedule.feedbackform')),
            ],
            options={
                'ordering': ['order'],
            },
        ),
        migrations.CreateModel(
            name='FeedbackResponse',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('answers', models.JSONField(default=dict)),
                ('submitted_at', models.DateTimeField(auto_now_add=True)),
                ('form', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='responses', to='schedule.feedbackform')),
                ('session', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='feedback_responses', to='schedule.schedulesession')),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='FeedbackAnswer',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('answer_text', models.TextField(blank=True, null=True)),
                ('rating_value', models.IntegerField(blank=True, null=True)),
                ('question', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='schedule.feedbackquestion')),
                ('response', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='answers_list', to='schedule.feedbackresponse')),
            ],
        ),
        migrations.CreateModel(
            name='SessionBookmark',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('session', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='schedule.schedulesession')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'unique_together': {('user', 'session')},
            },
        ),
    ]
