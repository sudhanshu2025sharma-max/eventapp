import os
import sys
import django
from datetime import date

# Set up Django environment
sys.path.append('/home/baadalvm/eventapp/backend')
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "confhub.settings")
django.setup()

from apps.schedule.models import ScheduleSession
from apps.checkins.meal_utils import sync_meal_window

def main():
    print("🔍 Fetching all schedule sessions...")
    sessions = ScheduleSession.objects.all().order_by('day', 'start_datetime')
    
    if not sessions.exists():
        print("❌ No sessions found in the database.")
        return

    updated_count = 0
    
    # Target Mapping
    date_mapping = {
        1: date(2026, 9, 18),  # Day 1 -> 18th Sep 2026
        2: date(2026, 9, 19),  # Day 2 -> 19th Sep 2026
        3: date(2026, 9, 20),  # Day 3 -> 20th Sep 2026
    }

    for session in sessions:
        # Determine day number
        try:
            day_num = int(session.day)
        except (ValueError, TypeError):
            day_str = str(session.day).lower()
            if '1' in day_str:
                day_num = 1
            elif '2' in day_str:
                day_num = 2
            elif '3' in day_str:
                day_num = 3
            else:
                day_num = None

        if day_num in date_mapping:
            target_date = date_mapping[day_num]
            
            old_start = session.start_datetime
            old_end = session.end_datetime
            
            # Update start_datetime preserving original time and timezone
            if session.start_datetime:
                session.start_datetime = session.start_datetime.replace(
                    year=target_date.year,
                    month=target_date.month,
                    day=target_date.day
                )
                
            # Update end_datetime preserving original time and timezone
            if session.end_datetime:
                session.end_datetime = session.end_datetime.replace(
                    year=target_date.year,
                    month=target_date.month,
                    day=target_date.day
                )
                
            session.save()
            
            print(f"✅ [Day {day_num}] '{session.title[:32]}' "
                  f"| {old_start.strftime('%Y-%m-%d %H:%M') if old_start else 'None'} "
                  f"➡️ {session.start_datetime.strftime('%Y-%m-%d %H:%M') if session.start_datetime else 'None'}")
            
            # Also update any sub-sessions if present
            if hasattr(session, 'sub_sessions'):
                for sub in session.sub_sessions.all():
                    if hasattr(sub, 'start_datetime') and sub.start_datetime:
                        sub.start_datetime = sub.start_datetime.replace(
                            year=target_date.year, month=target_date.month, day=target_date.day
                        )
                    if hasattr(sub, 'end_datetime') and sub.end_datetime:
                        sub.end_datetime = sub.end_datetime.replace(
                            year=target_date.year, month=target_date.month, day=target_date.day
                        )
                    sub.save()
            
            updated_count += 1
        else:
            print(f"⚠️ Skipped: '{session.title[:30]}' (Unknown day designation: {session.day})")

    print(f"\n🎉 Successfully updated {updated_count} sessions to Sep 18–20, 2026.")

    # Synchronize meal windows
    print("🍽️ Syncing meal windows...")
    try:
        sync_meal_window()
        print("✅ Meal windows synchronized successfully!")
    except Exception as e:
        print(f"⚠️ Meal window sync info: {e}")

if __name__ == '__main__':
    main()
