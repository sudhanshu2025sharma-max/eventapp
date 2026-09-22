import os, random, django
from datetime import date, timedelta, time

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'confhub.settings')
django.setup()

from apps.schedule.models import (
    ScheduleSession, AcceptedPaper, ScheduleSubSession, 
    SessionBookmark, FeedbackResponse, FeedbackForm, 
    FeedbackQuestion, FeedbackAnswer
)

# ==============================================================================
# 📅 CONFIGURABLE START DATE
# ==============================================================================
# Set to date(2026, 10, 23) for exact HTML dates (Oct 23-25, 2026)
# OR set to date.today() for instant testing today!
# ==============================================================================
START_DATE = date(2026, 9, 20) 
# START_DATE = date.today()  # Uncomment this line when testing today!

day1 = START_DATE
day2 = START_DATE + timedelta(days=1)
day3 = START_DATE + timedelta(days=2)

ROOMS = [
    'Main Auditorium', 'Seminar Hall 1', 'Seminar Hall 2',
    'LHC - 111', 'LHC - 112', 'LHC - 211',
    'Bharti School Auditorium', 'Library Conference Room',
    'SAC Multipurpose Hall', 'Exhibition Area',
]

def get_room(stype):
    if stype == 'meal':
        return 'Dining Area / Exhibition Foyer'
    if stype == 'ceremony' or stype == 'keynote':
        return 'Main Auditorium'
    if stype == 'ideathon':
        return 'SAC Multipurpose Hall'
    return random.choice(ROOMS)

print("🧹 STEP 1: FLUSHING ALL OLD SCHEDULE DATA...")
for Model in (FeedbackAnswer, FeedbackResponse, FeedbackQuestion, FeedbackForm,
              SessionBookmark, AcceptedPaper, ScheduleSubSession, ScheduleSession):
    Model.objects.all().delete()
print("✅ Database flushed clean.\n")

print(f"🌱 STEP 2: SEEDING SCHEDULE (Starting {day1} → {day3})...")

sessions_data = [
    # ── DAY 1 (Friday, Oct 23) ──
    (1, day1, time(8,30),  time(9,30),  'Registration', 'ceremony', 'Check-in', False),
    (1, day1, time(9,30),  time(10,15), 'Inaugural Session', 'ceremony', 'Opening ceremony with dignitaries and Presidential address', True),
    (1, day1, time(10,15), time(11,0),  'Group Photo, Inauguration of Exhibition and High Tea', 'break', '', False),
    (1, day1, time(11,0),  time(13,0),  'ETD Workshop', 'workshop', 'Hands-on Workshop', False),
    (1, day1, time(13,0),  time(13,45), 'Lunch Break and Visit to Exhibition Area', 'meal', 'Lunch', False),
    (1, day1, time(13,45), time(14,15), 'Keynote Address - 1', 'keynote', 'Featured Keynote', True),
    (1, day1, time(14,15), time(16,5),  'Technical Session - 1', 'technical', '14:15 - 14:55: Invited Talk\n14:55 - 16:05: Paper Presentations', False),
    (1, day1, time(16,5),  time(16,25), 'Tea Break and Visit to Exhibition Area', 'break', '', False),
    (1, day1, time(16,25), time(18,10), 'Technical Session - 2', 'technical', '16:25 - 17:15: Lab Papers\n17:15 - 17:45: Posters\n17:45 - 18:10: Exhibition', False),
    (1, day1, time(18,30), time(20,0),  'Cultural Event', 'cultural', 'Evening Cultural Performance', False),
    (1, day1, time(20,0),  time(22,0),  'Dinner', 'meal', 'Dinner', False),

    # ── DAY 2 (Saturday, Oct 24) ──
    (2, day2, time(9,0),   time(9,30),  'Keynote Address - 2', 'keynote', 'Featured Keynote', True),
    # Parallel Ideathon & Tech Sessions
    (2, day2, time(9,30),  time(13,0),  'Ideathon (Parallel)', 'ideathon', 'Innovation Challenge - Collaborative solution development', True),
    (2, day2, time(9,30),  time(11,0),  'Technical Session - 3', 'technical', '09:30 - 10:10: Invited Talk\n10:10 - 10:50: Papers\n10:50 - 11:00: Product', False),
    (2, day2, time(11,0),  time(11,20), 'Tea Break and Visit to Exhibition Area', 'break', '', False),
    (2, day2, time(11,20), time(13,0),  'Technical Session - 4', 'technical', '11:20 - 12:00: Invited Talk\n12:00 - 12:50: Papers\n12:50 - 13:00: Product', False),
    
    (2, day2, time(13,0),  time(13,45), 'Lunch Break and Visit to Exhibition Area', 'meal', 'Lunch', False),
    (2, day2, time(13,45), time(15,35), 'Technical Session - 5', 'technical', '13:45 - 14:25: Invited Talk\n14:25 - 15:25: Papers\n15:25 - 15:35: Product', False),
    (2, day2, time(15,35), time(16,0),  'Tea Break and Visit to Exhibition Area', 'break', '', False),
    (2, day2, time(16,0),  time(17,40), 'Technical Session - 6', 'technical', '16:00 - 16:40: Invited Talk\n16:40 - 17:30: Papers\n17:30 - 17:40: Product', False),
    (2, day2, time(17,40), time(18,10), 'Ideathon Presentations', 'ideathon', 'Presentations (5 minutes each)', False),
    (2, day2, time(19,30), time(21,0),  'Gala Dinner', 'meal', 'Gala Dinner', False),

    # ── DAY 3 (Sunday, Oct 25) ──
    (3, day3, time(9,0),   time(9,30),  'Keynote Address - 3', 'keynote', 'Featured Keynote', True),
    (3, day3, time(9,30),  time(11,10), 'Technical Session - 7', 'technical', '09:30 - 10:10: Invited Talk\n10:10 - 11:00: Papers\n11:00 - 11:10: Product', False),
    (3, day3, time(11,10), time(11,30), 'Tea Break and Visit to Exhibition Area', 'break', '', False),
    (3, day3, time(11,30), time(13,0),  'Technical Session - 8', 'technical', '11:30 - 12:10: Invited Talk\n12:10 - 12:50: Papers\n12:50 - 13:00: Product', False),
    (3, day3, time(13,0),  time(13,45), 'Lunch Break and Visit to Exhibition Area', 'meal', 'Lunch', False),
    (3, day3, time(13,45), time(15,35), 'Technical Session - 9', 'technical', '13:45 - 14:25: Invited Talk\n14:25 - 15:25: Papers\n15:25 - 15:35: Product', False),
    (3, day3, time(15,35), time(15,55), 'Tea Break and Visit to Exhibition Area', 'break', '', False),
    (3, day3, time(15,55), time(17,0),  'Panel Discussion', 'panel', 'Expert Panel Discussion', True),
    (3, day3, time(17,0),  time(18,0),  'Concluding Session', 'ceremony', 'Closing Ceremony & Awards', True),
    (3, day3, time(18,0),  time(19,0),  'High Tea', 'break', '', False),
]

created_sessions = []
for day_num, d, st, et, title, stype, desc, feat in sessions_data:
    s = ScheduleSession.objects.create(
        day=day_num,
        date=d,
        start_time=st,
        end_time=et,
        title=title,
        session_type=stype,
        description=desc,
        room=get_room(stype),
        is_featured=feat,
        is_published=True,  # 🟢 PUBLISHED!
        status='published', # 🟢 NOT DRAFT!
    )
    created_sessions.append(s)

# Add nested papers under Technical Session 1
ts1 = next(s for s in created_sessions if s.title == 'Technical Session - 1')
AcceptedPaper.objects.create(
    session=ts1, paper_id='ETD-001', paper_type='paper',
    title='Automated Metadata Extraction for Indian ETDs',
    authors='Dr. R. Kumar, A. Sharma',
    slot_start=time(14,55), slot_end=time(15,15), is_published=True,
)
AcceptedPaper.objects.create(
    session=ts1, paper_id='ETD-002', paper_type='paper',
    title='AI-Driven Citation Analysis in Academic Repositories',
    authors='M. Patel, S. Gupta',
    slot_start=time(15,15), slot_end=time(15,35), is_published=True,
)

print(f"✅ Successfully seeded {len(created_sessions)} PUBLISHED sessions!")
print(f"   Dates: Day 1 ({day1}), Day 2 ({day2}), Day 3 ({day3})\n")
