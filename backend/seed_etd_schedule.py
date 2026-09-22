import os
import django
from datetime import date, timedelta, time

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'confhub.settings')
django.setup()

from apps.schedule.models import ScheduleSession, AcceptedPaper

print("🗑️ Flushing old schedule data...")
ScheduleSession.objects.all().delete()
AcceptedPaper.objects.all().delete()

# Set starting date to today for instant testing
TESTING_START_DATE = date.today()

day1 = TESTING_START_DATE
day2 = TESTING_START_DATE + timedelta(days=1)
day3 = TESTING_START_DATE + timedelta(days=2)

print(f"🌱 Seeding Schedule starting from {day1}...")

sessions = [
    # DAY 1
    (day1, time(8,30), time(9,30), 'Registration', 'ceremony', 'Check-in'),
    (day1, time(9,30), time(10,15), 'Inaugural Session', 'ceremony', 'Opening ceremony with dignitaries and Presidential address'),
    (day1, time(10,15), time(11,0), 'Group Photo, Inauguration of Exhibition and High Tea', 'break', ''),
    (day1, time(11,0), time(13,0), 'ETD Workshop', 'workshop', 'Hands-on Workshop'),
    (day1, time(13,0), time(13,45), 'Lunch Break and Visit to Exhibition Area', 'meal', ''),
    (day1, time(13,45), time(14,15), 'Keynote Address - 1', 'keynote', ''),
    (day1, time(14,15), time(16,5), 'Technical Session - 1', 'technical', '14:15 - 14:55: Invited Talk\n14:55 - 16:05: Paper Presentations'),
    (day1, time(16,5), time(16,25), 'Tea Break and Visit to Exhibition Area', 'break', ''),
    (day1, time(16,25), time(18,10), 'Technical Session - 2', 'technical', 'Innovative Lab Papers / Poster Presentations'),
    (day1, time(18,30), time(20,0), 'Cultural Event', 'cultural', ''),
    (day1, time(20,0), time(22,0), 'Dinner', 'meal', ''),

    # DAY 2
    (day2, time(9,0), time(9,30), 'Keynote Address - 2', 'keynote', ''),
    
    # --- PARALLEL BLOCK (Day 2) ---
    (day2, time(9,30), time(13,0), 'Ideathon (Parallel)', 'ideathon', 'Innovation Challenge - Collaborative solution development'),
    (day2, time(9,30), time(11,0), 'Technical Session - 3', 'technical', 'Paper Presentations'),
    (day2, time(11,0), time(11,20), 'Tea Break', 'break', ''),
    (day2, time(11,20), time(13,0), 'Technical Session - 4', 'technical', 'Paper Presentations'),
    # ------------------------------

    (day2, time(13,0), time(13,45), 'Lunch Break', 'meal', ''),
    (day2, time(13,45), time(15,35), 'Technical Session - 5', 'technical', 'Paper Presentations'),
    (day2, time(15,35), time(16,0), 'Tea Break', 'break', ''),
    (day2, time(16,0), time(17,40), 'Technical Session - 6', 'technical', 'Paper Presentations'),
    (day2, time(17,40), time(18,10), 'Ideathon Presentations', 'ideathon', 'Presentations (5 minutes each)'),
    (day2, time(19,30), time(21,0), 'Gala Dinner', 'meal', ''),

    # DAY 3
    (day3, time(9,0), time(9,30), 'Keynote Address - 3', 'keynote', ''),
    (day3, time(9,30), time(11,10), 'Technical Session - 7', 'technical', 'Paper Presentations'),
    (day3, time(11,10), time(11,30), 'Tea Break', 'break', ''),
    (day3, time(11,30), time(13,0), 'Technical Session - 8', 'technical', 'Paper Presentations'),
    (day3, time(13,0), time(13,45), 'Lunch Break', 'meal', ''),
    (day3, time(13,45), time(15,35), 'Technical Session - 9', 'technical', 'Paper Presentations'),
    (day3, time(15,35), time(15,55), 'Tea Break', 'break', ''),
    (day3, time(15,55), time(17,0), 'Panel Discussion', 'panel', ''),
    (day3, time(17,0), time(18,0), 'Concluding Session', 'ceremony', ''),
    (day3, time(18,0), time(19,0), 'High Tea', 'break', ''),
]

for d, start, end, title, type_, desc in sessions:
    s = ScheduleSession.objects.create(
        date=d, start_time=start, end_time=end, 
        title=title, session_type=type_, description=desc, room='TBD'
    )
    
    if title == 'Technical Session - 1':
        AcceptedPaper.objects.create(
            session=s, paper_id='ETD-001', paper_type='paper',
            title='Automated Metadata Extraction for Indian ETDs',
            authors='Dr. R. Kumar, A. Sharma', slot_start=time(14,55), slot_end=time(15,15)
        )
        AcceptedPaper.objects.create(
            session=s, paper_id='ETD-002', paper_type='paper',
            title='AI-Driven Citation Analysis',
            authors='M. Patel', slot_start=time(15,15), slot_end=time(15,35)
        )

print("✅ Schedule Seeded Successfully!")
