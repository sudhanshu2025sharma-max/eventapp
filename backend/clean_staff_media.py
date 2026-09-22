import os, sys, django, shutil

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'confhub.settings')
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

from django.conf import settings
from apps.accounts.models import StaffProfile

STAFF_DIR = os.path.join(settings.MEDIA_ROOT, 'staff')

print("🧹 Starting Staff Media De-duplication...")

for profile in StaffProfile.objects.all():
    email = profile.user.email.lower().strip()
    name_slug = profile.user.get_full_name().lower().replace(" ", "_").replace(".", "")
    
    if profile.photo:
        old_path = os.path.join(settings.MEDIA_ROOT, str(profile.photo))
        if os.path.exists(old_path):
            ext = os.path.splitext(old_path)[1].lower() or '.jpg'
            new_fname = f"staff_{name_slug}{ext}"
            new_rel_path = f"staff/{new_fname}"
            new_abs_path = os.path.join(settings.MEDIA_ROOT, new_rel_path)
            
            if old_path != new_abs_path:
                shutil.move(old_path, new_abs_path)
                print(f"  🔄 Renamed: {profile.photo} -> {new_rel_path}")
            
            profile.photo = new_rel_path
            profile.save(update_fields=['photo'])

# Clean up orphan/duplicate files in the directory
all_active_photos = set(
    StaffProfile.objects.exclude(photo='').values_list('photo', flat=True)
)

print("\n🗑 Removing unreferenced files...")
for fname in os.listdir(STAFF_DIR):
    rel_path = f"staff/{fname}"
    abs_path = os.path.join(STAFF_DIR, fname)
    if rel_path not in all_active_photos:
        if os.path.isfile(abs_path):
            os.remove(abs_path)
            print(f"  ❌ Deleted unused file: {rel_path}")

print("✅ Cleanup complete.")
