cd /home/baadalvm/eventapp/backend
python3 << 'EOF'
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'confhub.settings')
django.setup()

from apps.accounts.models import User, StaffPermission

email = "google.reviewer@iitd.ac.in"
password = "Reviewer@2026!"

user = User.objects.filter(email=email).first()
if not user:
    user = User.objects.create_user(
        email=email,
        password=password,
        first_name="Google",
        last_name="Reviewer",
        role="super_admin",
        is_active=True
    )
    print("✅ Created Super Admin reviewer account!")
else:
    user.set_password(password)
    user.role = "super_admin"
    user.is_active = True
    user.save()
    print("✅ Reset existing reviewer account to Super Admin!")

# Grant all 23 staff permissions as backup
MODULES = [
    'participants', 'ideathon', 'meal_scanner', 'checkin_scanner',
    'schedule', 'papers', 'photos', 'checkpoint', 'feed',
    'polls', 'qa_manager', 'leaderboard', 'chat', 'reported_messages',
    'shake_logs', 'chat_analytics', 'notifications', 'sponsors',
    'speakers', 'users_manage', 'reports', 'settings', 'error_reports'
]

for mod in MODULES:
    StaffPermission.objects.get_or_create(user=user, module=mod)

print(f"\nAccount Details for Google Play Console:")
print(f"Email:    {user.email}")
print(f"Password: {password}")
print(f"Role:     {user.role}")
print(f"Active:   {user.is_active}")
EOF