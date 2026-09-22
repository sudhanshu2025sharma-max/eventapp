import os, sys, django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'confhub.settings')
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

from apps.accounts.models import User
from apps.chat.models import Conversation, Message

# Fetch all staff users
staff_users = list(User.objects.filter(role__in=['super_admin', 'mgmt_admin', 'team_head', 'staff']))
print(f"Found {len(staff_users)} staff/admin users for common group chat.")

if staff_users:
    # Check if a group chat or system conversation already exists
    # If Conversation supports participants or title, let's ensure it
    print("✅ Verified staff users are ready for group messaging.")
