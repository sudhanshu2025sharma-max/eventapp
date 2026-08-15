import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'confhub.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from apps.speakers.models import Speaker
from apps.accounts.models import User

linked = 0
skipped = 0

for speaker in Speaker.objects.all():
    if speaker.user_id:
        print(f"⏭️  Already linked: {speaker.first_name} {speaker.last_name}")
        skipped += 1
        continue
    
    # Match by name (same convention as link_speakers_users.py)
    first = speaker.first_name.lower().replace(' ', '').replace('.', '').replace(',', '')
    last = speaker.last_name.lower().replace(' ', '').replace('.', '').replace(',', '')
    email = f"{first}.{last}@speaker.etd2026.iitd.ac.in"
    
    user = User.objects.filter(email=email).first()
    if not user:
        print(f"❌ No user found for {speaker.first_name} {speaker.last_name} ({email})")
        continue
    
    # Sync data Speaker → User (so both screens show same info)
    user.designation = speaker.designation or user.designation
    user.affiliation = speaker.institute or user.affiliation
    user.bio = speaker.bio or user.bio
    user.linkedin_url = speaker.linkedin_url or user.linkedin_url
    if speaker.photo and not user.profile_photo:
        user.profile_photo = speaker.photo.name
    user.save()
    
    # Link
    speaker.user = user
    speaker.save()
    linked += 1
    print(f"🔗 Linked: {speaker.first_name} {speaker.last_name} → {email}")

print(f"\n🎉 Linked: {linked} | Skipped (already): {skipped}")
print(f"Total Speakers: {Speaker.objects.count()}")
print(f"Linked Speakers: {Speaker.objects.filter(user__isnull=False).count()}")
