"""
Send push notifications for upcoming sessions and presentations.

Logic:
  1. Featured sessions  -> notify ALL active device tokens 60 min before start (once)
  2. All sessions       -> notify ALL active device tokens 5 min before start (once)
  3. Session bookmarks  -> notify user at chosen reminder_minutes before start (once)
  4. Paper bookmarks    -> notify user at chosen reminder_minutes before slot_start (once)
"""
from datetime import timedelta, datetime
from zoneinfo import ZoneInfo
from django.core.management.base import BaseCommand
from django.utils import timezone

IST = ZoneInfo("Asia/Kolkata")


class Command(BaseCommand):
    help = 'Send session and paper reminder push notifications'

    def handle(self, *args, **options):
        from apps.schedule.models import ScheduleSession, SessionBookmark, PaperBookmark
        from apps.notifications.models import DeviceToken
        from apps.notifications.fcm import send_to_tokens

        now_ist = datetime.now(IST)

        # Active push tokens
        all_tokens = list(DeviceToken.objects.filter(is_active=True).values_list('token', flat=True))

        # -------------------------------------------------------------
        # 1. FEATURED SESSIONS: 60 min reminder to ALL users
        # -------------------------------------------------------------
        target_60_min = now_ist + timedelta(minutes=60)
        featured = ScheduleSession.objects.filter(
            is_published=True,
            is_featured=True,
            notify_featured_60_sent_at__isnull=True,
            date=target_60_min.date(),
            start_time__range=(
                (target_60_min - timedelta(minutes=2)).time(),
                (target_60_min + timedelta(minutes=2)).time(),
            )
        )
        for sess in featured:
            if all_tokens:
                send_to_tokens(
                    all_tokens,
                    '⭐ Starting in 1 hour',
                    f'{sess.title} starts at {sess.start_time.strftime("%I:%M %p")}.' + (f' Room: {sess.room}' if sess.room else ''),
                    {'type': 'schedule', 'session_id': str(sess.id)}
                )
            sess.notify_featured_60_sent_at = timezone.now()
            sess.save(update_fields=['notify_featured_60_sent_at'])
            self.stdout.write(f'Featured 60m reminder sent: {sess.title}')

        # -------------------------------------------------------------
        # 2. ALL SESSIONS: 5 min reminder to ALL users
        # -------------------------------------------------------------
        target_5_min = now_ist + timedelta(minutes=5)
        upcoming_5m = ScheduleSession.objects.filter(
            is_published=True,
            notify_all_5_sent_at__isnull=True,
            date=target_5_min.date(),
            start_time__range=(
                (target_5_min - timedelta(minutes=2)).time(),
                (target_5_min + timedelta(minutes=2)).time(),
            )
        )
        for sess in upcoming_5m:
            if all_tokens:
                send_to_tokens(
                    all_tokens,
                    '🔔 Starting in 5 minutes',
                    f'{sess.title} is starting shortly.' + (f' Room: {sess.room}' if sess.room else ''),
                    {'type': 'schedule', 'session_id': str(sess.id)}
                )
            sess.notify_all_5_sent_at = timezone.now()
            sess.save(update_fields=['notify_all_5_sent_at'])
            self.stdout.write(f'5m all-users reminder sent: {sess.title}')

        # -------------------------------------------------------------
        # 3. BOOKMARKED SESSIONS: User custom reminder_minutes
        # -------------------------------------------------------------
        session_bookmarks = SessionBookmark.objects.filter(
            reminder_sent=False,
            session__is_published=True
        ).select_related('user', 'session')

        for bm in session_bookmarks:
            sess = bm.session
            if not sess.date or not sess.start_time:
                continue
            
            sess_dt_ist = datetime.combine(sess.date, sess.start_time).replace(tzinfo=IST)
            remind_time = sess_dt_ist - timedelta(minutes=bm.reminder_minutes)

            # Check if within 2-minute trigger window
            if abs((now_ist - remind_time).total_seconds()) <= 120:
                user_tokens = list(DeviceToken.objects.filter(user=bm.user, is_active=True).values_list('token', flat=True))
                if user_tokens:
                    label = f'{bm.reminder_minutes} min' if bm.reminder_minutes < 60 else '1 hour'
                    send_to_tokens(
                        user_tokens,
                        f'⏰ Starting in {label}',
                        f'{sess.title} starts soon.' + (f' Room: {sess.room}' if sess.room else ''),
                        {'type': 'schedule', 'session_id': str(sess.id)}
                    )
                bm.reminder_sent = True
                bm.save(update_fields=['reminder_sent'])
                self.stdout.write(f'Session bookmark reminder sent: {bm.user.email} -> {sess.title}')

        # -------------------------------------------------------------
        # 4. BOOKMARKED PAPERS / PRESENTATIONS
        # -------------------------------------------------------------
        paper_bookmarks = PaperBookmark.objects.filter(
            reminder_sent=False,
            paper__is_published=True
        ).select_related('user', 'paper', 'paper__session')

        for pbm in paper_bookmarks:
            paper = pbm.paper
            sess = paper.session
            paper_date = sess.date if sess else None
            paper_start = paper.slot_start or (sess.start_time if sess else None)

            if not paper_date or not paper_start:
                continue

            paper_dt_ist = datetime.combine(paper_date, paper_start).replace(tzinfo=IST)
            remind_time = paper_dt_ist - timedelta(minutes=pbm.reminder_minutes)

            if abs((now_ist - remind_time).total_seconds()) <= 120:
                user_tokens = list(DeviceToken.objects.filter(user=pbm.user, is_active=True).values_list('token', flat=True))
                if user_tokens:
                    label = f'{pbm.reminder_minutes} min' if pbm.reminder_minutes < 60 else '1 hour'
                    send_to_tokens(
                        user_tokens,
                        f'📄 Presentation Starting in {label}',
                        f'"{paper.title}" is starting soon.' + (f' Room: {sess.room}' if sess and sess.room else ''),
                        {'type': 'schedule', 'paper_id': str(paper.id)}
                    )
                pbm.reminder_sent = True
                pbm.save(update_fields=['reminder_sent'])
                self.stdout.write(f'Paper bookmark reminder sent: {pbm.user.email} -> {paper.title}')

        self.stdout.write(self.style.SUCCESS(f'Reminder check completed at {now_ist:%Y-%m-%d %H:%M:%S IST}'))
