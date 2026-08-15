import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'confhub.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from apps.speakers.models import Speaker
from apps.accounts.models import User
from django.core.files import File

created = 0
skipped = 0

for speaker in Speaker.objects.all():
    # Generate email from name
    email = f"{speaker.first_name.lower().replace(' ', '').replace('.', '')}.{speaker.last_name.lower().replace(' ', '').replace('.', '')}@speaker.etd2026.iitd.ac.in"
    
    if User.objects.filter(email=email).exists():
        print(f"⏭️  Exists: {email}")
        skipped += 1
        continue
    
    user = User.objects.create_user(
        email=email,
        password='Speaker@2026',
        first_name=speaker.first_name,
        last_name=speaker.last_name,
    )
    user.role = 'speaker'
    user.is_active = True
    user.designation = speaker.designation
    
    # Copy photo from speaker to user profile if User model has photo field
    if hasattr(user, 'profile_photo') and speaker.photo:
        try:
            user.profile_photo = speaker.photo
        except:
            pass
    
    user.save()
    print(f"✅ Created: {speaker.first_name} {speaker.last_name} → {email}")
    created += 1

print(f"\n🎉 Created: {created} | Skipped: {skipped}")
print(f"Total speaker users: {User.objects.filter(role='speaker').count()}")
