"""
Create a test session starting N minutes from now for reminder testing.
Usage:
  python3 manage.py create_test_session          # starts in 10 min
  python3 manage.py create_test_session --mins 6 # starts in 6 min
  python3 manage.py create_test_session --clean  # delete all test sessions
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta


class Command(BaseCommand):
    help = 'Create a test session for reminder testing'

    def add_arguments(self, parser):
        parser.add_argument('--mins', type=int, default=10,
                            help='Minutes from now to start (default: 10)')
        parser.add_argument('--clean', action='store_true',
                            help='Delete all test sessions instead')

    def handle(self, *args, **options):
        from apps.schedule.models import ScheduleSession, FeedbackForm, FeedbackQuestion

        if options['clean']:
            deleted, _ = ScheduleSession.objects.filter(
                title__startswith='[TEST]'
            ).delete()
            self.stdout.write(self.style.SUCCESS(f'Deleted {deleted} test session(s).'))
            return

        mins = options['mins']
        now  = timezone.now()
        start = now + timedelta(minutes=mins)
        end   = start + timedelta(minutes=30)

        sess = ScheduleSession.objects.create(
            day=1,
            title=f'[TEST] Reminder Test — starts in {mins} min',
            session_type='keynote',
            start_datetime=start,
            end_datetime=end,
            room='Test Room',
            is_featured=True,
            is_published=True,
            feedback_enabled=True,
            feedback_auto_open=True,
            display_order=0,
        )

        # Create default feedback form
        form = FeedbackForm.objects.create(
            session=sess,
            title='Test Feedback Form',
        )
        FeedbackQuestion.objects.bulk_create([
            FeedbackQuestion(form=form, question_text='Rate this session', question_type='rating', is_required=True, display_order=1),
            FeedbackQuestion(form=form, question_text='Would you recommend?', question_type='boolean', is_required=True, display_order=2),
            FeedbackQuestion(form=form, question_text='Any comments?', question_type='text', is_required=False, display_order=3),
        ])

        self.stdout.write(self.style.SUCCESS(
            f'\n✅ Test session created:'
            f'\n   Title    : {sess.title}'
            f'\n   ID       : {sess.id}'
            f'\n   Starts at: {start.strftime("%Y-%m-%d %H:%M:%S UTC")}'
            f'\n   In       : {mins} minutes'
            f'\n   Featured : Yes (gets 1hr + 5min all-users push)'
            f'\n'
            f'\nNext steps:'
            f'\n  1. Open Schedule tab in app → find [TEST] session → bookmark it (♡)'
            f'\n  2. Run reminder check now:  python3 manage.py send_session_reminders'
            f'\n  3. Wait {max(mins-1,1)} min then run again for the reminder window'
            f'\n  4. Clean up: python3 manage.py create_test_session --clean'
        ))
