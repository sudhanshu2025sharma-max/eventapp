import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'eventapp.settings')
django.setup()
from apps.accounts.models import User

# Organizers
ot_users = User.objects.filter(role='staff').order_by('staffprofile__order')
for i, u in enumerate(ot_users, start=1):
    u.registration_id = f"ETD-2026-OT{i:02d}"
    u.save(update_fields=['registration_id'])

# Speakers
speakers = User.objects.filter(role='speaker').order_by('id')
for i, u in enumerate(speakers, start=1):
    u.registration_id = f"ETD-2026-SPK{i:02d}"
    u.save(update_fields=['registration_id'])
print("✅ Assigned OT and Speaker Registration IDs.")
