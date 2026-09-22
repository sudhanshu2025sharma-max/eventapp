import os, sys, django, urllib3
from PIL import Image, ImageDraw, ImageFont

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'confhub.settings')
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

from django.conf import settings
from apps.accounts.models import StaffProfile

MEDIA_DIR = os.path.join(settings.MEDIA_ROOT, 'staff')
os.makedirs(MEDIA_DIR, exist_ok=True)

# Tier distinct background colors
TIER_COLORS = {
    'librarian': '#4f46e5',  # Indigo
    'deputy':    '#0891b2',  # Cyan
    'assistant': '#059669',  # Emerald
    'staff':     '#d97706',  # Amber
}

def hex_to_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

for profile in StaffProfile.objects.all():
    # If photo file doesn't physically exist on disk, generate a clean initials avatar
    needs_avatar = not profile.photo
    if profile.photo:
        filepath = os.path.join(settings.MEDIA_ROOT, str(profile.photo))
        if not os.path.exists(filepath):
            needs_avatar = True

    if needs_avatar:
        first = profile.user.first_name or ''
        last = profile.user.last_name or ''
        initials = (first[:1] + (last[:1] if last else '')).upper() or 'ST'
        
        bg_color = hex_to_rgb(TIER_COLORS.get(profile.tier, '#4f46e5'))
        
        # 300x300 avatar
        img = Image.new('RGB', (300, 300), color=bg_color)
        draw = ImageDraw.Draw(img)
        
        # Use default bitmap font scaled or load basic
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 110)
        except Exception:
            font = ImageFont.load_default()
            
        bbox = draw.textbbox((0, 0), initials, font=font)
        w = bbox[2] - bbox[0]
        h = bbox[3] - bbox[1]
        draw.text(((300 - w) / 2, (300 - h) / 2 - 10), initials, fill=(255, 255, 255), font=font)
        
        filename = f"avatar_{profile.user.id}.png"
        rel_path = f"staff/{filename}"
        full_path = os.path.join(settings.MEDIA_ROOT, rel_path)
        img.save(full_path, "PNG")
        
        profile.photo = rel_path
        profile.save(update_fields=['photo'])
        print(f"  🎨 Generated avatar for {profile.user.get_full_name()} ({initials}) -> {rel_path}")

print("✅ All staff members have photos/avatars ready.")
