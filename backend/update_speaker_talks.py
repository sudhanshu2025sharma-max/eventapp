import os, django
from datetime import date

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'confhub.settings')
django.setup()

from apps.speakers.models import SpeakerTalk

# Map tracks/titles to exact conference dates
date_updates = [
    # Day 1: Oct 23, 2026
    (date(2026, 10, 23), ["Welcome Address", "NDLTD", "IFLA President", "Guest of Honour", "Presidential Address", "Vote of Thanks", "WorkshopLead", "Keynote Speaker", "Invited Talk"]),
    # Day 2: Oct 24, 2026
    (date(2026, 10, 24), []),
    # Day 3: Oct 25, 2026
    (date(2026, 10, 25), []),
]

# Update any talks with old dates (14th/15th) to the actual conference dates
updated = 0
for talk in SpeakerTalk.objects.all():
    if talk.talk_date and talk.talk_date.day in [14, 15, 16]:
        # Shift 14 -> 23, 15 -> 24, 16 -> 25
        day_offset = talk.talk_date.day - 14
        new_day = 23 + day_offset
        talk.talk_date = date(2026, 10, new_day)
        talk.save()
        updated += 1

print(f"Updated {updated} SpeakerTalk dates to match official conference schedule (Oct 23-26, 2026)!")
