"""
Fix unlinked SpeakerTalks — match speaker names against
ScheduleSubSession.speaker_name (not session description).
"""
import os, sys, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'confhub.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from apps.speakers.models import Speaker, SpeakerTalk
from apps.schedule.models import ScheduleSession, ScheduleSubSession

def fmt_time(t_obj):
    if not t_obj: return ''
    h, m = t_obj.hour, t_obj.minute
    ampm = 'AM' if h < 12 else 'PM'
    h12 = h if h <= 12 else h - 12
    if h12 == 0: h12 = 12
    return f"{h12:02d}:{m:02d} {ampm}"

# Build lookup: lowercase speaker_name_fragment → parent session
sub_sessions = ScheduleSubSession.objects.select_related('session').all()

def find_session_for_speaker(first, last):
    """Search sub-session speaker_name for this speaker."""
    search_terms = [
        f"{first} {last}".lower(),
        last.lower(),  # fallback: just last name
    ]
    for term in search_terms:
        if len(term) < 3:
            continue
        for sub in sub_sessions:
            if term in sub.speaker_name.lower():
                return sub.session
    return None

# Keynote title → session title mapping (explicit, since keynote
# descriptions don't contain speaker names in sub-sessions)
KEYNOTE_MAP = {
    'Saral AI': 'Keynote Address – 1',
    'Next Evolution': 'Keynote Address – 2',
    'Show Your Working': 'Keynote Address – 3',
    'Internet Archive': 'Technical Session 9',
}

fixed = 0
still_broken = []

for talk in SpeakerTalk.objects.filter(talk_date__isnull=True).select_related('speaker'):
    sp = talk.speaker
    session = None

    # Keynotes: match by talk title keyword
    if talk.track == 'Keynote Speaker':
        for keyword, sess_title in KEYNOTE_MAP.items():
            if keyword in talk.title:
                session = ScheduleSession.objects.filter(title__icontains=sess_title).first()
                break

    # Chief Guest: Concluding Session
    elif talk.track == 'Chief Guest':
        session = ScheduleSession.objects.filter(title__icontains='Concluding').first()

    # Everything else: search sub-session speaker_name
    if not session:
        session = find_session_for_speaker(sp.first_name, sp.last_name)

    if session:
        talk.talk_date = session.date
        talk.talk_time = fmt_time(session.start_time)
        talk.save()
        fixed += 1
        print(f"  ✅ {sp.full_name}: {talk.title[:55]} → {session.title} ({session.date})")
    else:
        still_broken.append(f"{sp.full_name} — {talk.title}")

print(f"\n═══ RESULT ═══")
print(f"Fixed: {fixed}")
print(f"Still unlinked: {len(still_broken)}")
for b in still_broken:
    print(f"  ⚠ {b}")
