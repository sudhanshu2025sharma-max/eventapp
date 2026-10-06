import datetime
from zoneinfo import ZoneInfo
from django.utils import timezone
from django.db import models
from apps.checkins.models import MealWindow
from apps.checkins.push import push_to_checked_in

IST = ZoneInfo("Asia/Kolkata")


def deduce_meal_name(title):
    t = (title or "").lower().strip()
    if "lunch" in t: return "Lunch"
    if "gala" in t or "dinner" in t: return "Dinner"
    if "high tea" in t or "tea" in t: return "High Tea"
    if "breakfast" in t: return "Breakfast"
    return "Meal"


def sync_meal_window():
    from apps.schedule.models import ScheduleSession

    now_ist = timezone.now().astimezone(IST)
    today = now_ist.date()

    # Query today's published sessions where is_meal=True or session_type='meal'
    meal_sessions = ScheduleSession.objects.filter(
        date=today,
        is_published=True,
    ).filter(
        models.Q(is_meal=True) |
        models.Q(session_type='meal') |
        models.Q(title__icontains='lunch') |
        models.Q(title__icontains='dinner') |
        models.Q(title__icontains='breakfast') |
        models.Q(title__icontains='tea')
    ).order_by('start_time')

    active_session = None
    for s in meal_sessions:
        s0 = s.start_datetime
        s1 = s.end_datetime
        if s0 and s1 and s0 <= now_ist <= s1:
            active_session = s
            break

    display = active_session
    if display is None:
        for s in meal_sessions:
            if s.start_datetime and s.start_datetime > now_ist:
                display = s
                break
    if display is None and meal_sessions.exists():
        display = meal_sessions.last()

    meal_type_name = "Meal"
    if display:
        if getattr(display, 'is_meal', False) and getattr(display, 'meal_category', None):
            meal_type_name = display.meal_category
        else:
            meal_type_name = deduce_meal_name(display.title)

    # Safe fetch to prevent MultipleObjectsReturned
    window = MealWindow.objects.filter(date=today).order_by('-id').first()
    if not window:
        window = MealWindow.objects.create(date=today, is_open=False, meal_type=meal_type_name)

    if display is not None and display.start_datetime and display.end_datetime:
        s0 = display.start_datetime
        s1 = display.end_datetime
        if window.start_time != s0.time() or window.end_time != s1.time():
            window.start_time = s0.time()
            window.end_time = s1.time()
            window.save(update_fields=['start_time', 'end_time'])

    if active_session is not None:
        s1 = active_session.end_datetime
        if getattr(active_session, 'is_meal', False) and getattr(active_session, 'meal_category', None):
            active_meal_name = active_session.meal_category
        else:
            active_meal_name = deduce_meal_name(active_session.title)

        # Force window open for active meal session unless manually overridden
        if not window.is_open or window.meal_type != active_meal_name:
            if window.opened_by_id is not None and not window.is_open:
                return
            window.is_open = True
            window.meal_type = active_meal_name
            window.opened_by = None
            window.closed_at = None
            window.notified_closing = False
            window.save(update_fields=['is_open', 'meal_type', 'opened_by', 'closed_at', 'notified_closing'])

            if not window.notified_opening:
                window.notified_opening = True
                window.save(update_fields=['notified_opening'])
                push_to_checked_in(
                    title=f"🍽️ {active_meal_name} is now open!",
                    body=f"Dining service for {active_meal_name} has started. Closes at {s1.strftime('%I:%M %p')}.",
                    data={"type": "meal_pass", "screen": "qr"},
                )
        return

    if window.is_open and window.opened_by_id is not None:
        return

    if window.is_open:
        closed_meal_name = window.meal_type or "Meal"
        window.is_open = False
        window.closed_at = timezone.now()
        window.notified_opening = False
        window.save(update_fields=['is_open', 'closed_at', 'notified_opening'])
        if not window.notified_closing:
            window.notified_closing = True
            window.save(update_fields=['notified_closing'])
            push_to_checked_in(
                title=f"🛑 {closed_meal_name} service is now closed",
                body=f"Dining service for {closed_meal_name} has concluded.",
                data={"type": "meal_pass", "screen": "qr"},
            )
