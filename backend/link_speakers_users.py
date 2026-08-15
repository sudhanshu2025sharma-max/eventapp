import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'confhub.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from apps.speakers.models import Speaker
from apps.accounts.models import User

created_users = 0
linked = 0

for speaker in Speaker.objects.all():
    # Skip if already linked
    if speaker.user_id:
        print(f"⏭️  Already linked: {speaker.first_name} {speaker.last_name}")
        linked += 1
        continue
    
    # Generate clean email
    first = speaker.first_name.lower().replace(' ', '').replace('.', '').replace(',', '')
    last = speaker.last_name.lower().replace(' ', '').replace('.', '').replace(',', '')
    email = f"{first}.{last}@speaker.etd2026.iitd.ac.in"
    
    # Get or create user
    user = User.objects.filter(email=email).first()
    if not user:
        user = User.objects.create_user(
            email=email,
            password='Speaker@2026',
            first_name=speaker.first_name,
            last_name=speaker.last_name,
        )
        user.role = 'speaker'
        user.is_active = True
        created_users += 1
        print(f"✅ Created user: {email}")
    
    # Sync data from Speaker → User
    user.designation = speaker.designation or user.designation
    user.affiliation = speaker.institute or user.affiliation
    user.bio = speaker.bio or user.bio
    user.linkedin_url = speaker.linkedin_url or user.linkedin_url
    
    # Copy photo path (both point to same file)
    if speaker.photo and not user.profile_photo:
        user.profile_photo = speaker.photo.name
    
    user.save()
    
    # Link speaker ↔ user
    speaker.user = user
    speaker.save()
    linked += 1
    print(f"🔗 Linked: {speaker.first_name} {speaker.last_name} → {email}")

print(f"\n🎉 New users created: {created_users}")
print(f"🔗 Total linked: {linked}")
print(f"Total speakers: {Speaker.objects.count()}")
print(f"Total speaker users: {User.objects.filter(role='speaker').count()}")
