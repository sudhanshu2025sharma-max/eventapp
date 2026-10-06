import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'confhub.settings')
django.setup()

from apps.accounts.models import User

if len(sys.argv) < 2:
    print("Usage: python3 reset_guide.py <user_email>")
    sys.exit(1)

target_email = sys.argv[1].strip()
user = User.objects.filter(email__iexact=target_email).first()

if user:
    user.has_seen_guide = False
    user.save(update_fields=['has_seen_guide'])
    print(f"✅ Reset 'has_seen_guide' = False for: {user.email}")
else:
    print(f"❌ No user found matching email: '{target_email}'")
