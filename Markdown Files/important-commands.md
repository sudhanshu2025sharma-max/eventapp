# Start App in this sequence

# 1. Docker
cd /workspaces/eventapp && docker compose up -d

# 2. Django
cd /workspaces/eventapp/backend && python manage.py runserver 0.0.0.0:8000

# 3. ngrok (must be running — web uses it too now)
ngrok http 8000

# 4. Expo
cd /workspaces/eventapp/mobile && npx expo start --port 8081 --clear

# 5 Kill Port
kill -9 $(lsof -t -i:8081)

# See Reminders logs
tail -f /tmp/session_reminders.log 

Context Gen: Okay its working Now give me the full context to start a new chat with new feature to be build it must cover everything till now and i give you early. 
Now fundamentally everything is working fine we wont polishing so give me a full detailed context window in which you have to write everything that has done so far form first chat to last so that new chat have context of everything also mention the custom template folder how its link how other files are linked and how everything is working and wired up so give me context window for new chat.

# seed schedule!
cd /home/baadalvm/eventapp/backend
python3 manage.py seed_etd2026 --rebase-start today


# Watch live while you create a new feed post with Send Push ON
tail -f /home/baadalvm/eventapp/backend/server.log | grep --line-buffered -iE "FEED PUSH|expo|fcm|push|notification"


# RESTART SERVER (Always run from backend/ directory)
cd /home/baadalvm/eventapp/backend
pkill -f gunicorn || true
sleep 1.5
nohup ./start_server.sh > server.log 2>&1 &

# WATCH LIVE LOGS
tail -f /home/baadalvm/eventapp/backend/server.log | grep --line-buffered -iE "FEED PUSH|EXPO|fcm|push|notification"




# ONLY flush Sessions and add Sessions 

cd /home/baadalvm/eventapp/backend && python3 flush_and_seed.py && pkill -9 -f gunicorn || true && sleep 1.5 && nohup ./start_server.sh > server.log 2>&1 &



# Check Number of Users based on cateogry 


cd /home/baadalvm/eventapp/backend
python3 manage.py shell << 'EOF'
from apps.accounts.models import User
from django.db.models import Count

print("=" * 60)
print("TOTAL USERS:", User.objects.count())
print("=" * 60)
print("\nBREAKDOWN BY ROLE:")
for row in User.objects.values('role').annotate(c=Count('id')).order_by('-c'):
    print(f"  {row['role']:20s} → {row['c']}")

print("\nSAMPLE EMAILS (first 5 per role):")
for role in User.objects.values_list('role', flat=True).distinct():
    print(f"\n[{role}]")
    for u in User.objects.filter(role=role)[:5]:
        print(f"  - {u.email}")

print("\n" + "=" * 60)
print("APPLE REVIEW ACCOUNT CHECK:")
print("=" * 60)
# What email did you use for Apple review? Need to confirm.
for u in User.objects.filter(email__icontains='apple'):
    print(f"  {u.email} | role={u.role}")
for u in User.objects.filter(email__icontains='review'):
    print(f"  {u.email} | role={u.role}")
EOF




---
# Git Push 
```bash
cd /workspaces/eventapp && git add . && git commit -m "feat: YOUR MESSAGE" && git push origin main


git pull origin main --rebase && git push origin main
```
---


# Change Admin ID:
```bash
cd /workspaces/eventapp/backend && python3 manage.py shell -c "
from apps.accounts.models import User
u = User.objects.filter(email__in=['admin@confhub.com','admin@etd.iitd.ac.in']).first()
if u:
    old = u.email
    u.email = 'etd@admin.iitd.ac.in'
    u.save()
    print(f'✓ {old} → etd@admin.iitd.ac.in')
else:
    print('not found, existing emails:')
    print(list(User.objects.values_list('email', flat=True)[:10]))
"
```

# Start Expo Server
```bash
cd /workspaces/eventapp/mobile
npx expo start --tunnel --port 8081 --clear
```

# Reset the first screen login

python3 reset_guide.py participant@test.com
python3 reset_guide.py parthasarathi.mukhopadhyay@speaker.etd2026.iitd.ac.in


# Default Login Creds for app
```
=== ALL LOGIN CREDENTIALS ===
  admin@confhub.com | Role: super_admin | Password: Test@1234 (or Admin@1234 for admin)
  participant@test.com | Role: participant | Password: Test@1234 (or Admin@1234 for admin)
  speaker@test.com | Role: speaker | Password: Test@1234 (or Admin@1234 for admin)
```

# Reset Check in for test 
```bash
cd /workspaces/eventapp/backend && python -c "
import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'confhub.settings')
django.setup()
from apps.checkins.models import CheckIn
count = CheckIn.objects.all().delete()[0]
print(f'✓ Deleted {count} check-ins — ready for fresh testing')
"
```

# Rest a single user check in 


cd /home/baadalvm/eventapp/backend && python3 -c "
import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'confhub.settings')
django.setup()

from django.db import models
from apps.checkins.models import CheckIn
from apps.accounts.models import User

TARGET = 'director.desidoc@gov.in'

user = User.objects.filter(
    models.Q(email__iexact=TARGET) | models.Q(registration_id__iexact=TARGET)
).first()

if user:
    deleted, _ = CheckIn.objects.filter(user=user).delete()
    print(f'✓ Reset check-in for {user.get_full_name()} ({user.email}) — Deleted {deleted} check-in record(s).')
else:
    print(f'❌ User \"{TARGET}\" not found.')
"


# Test Push notification check:

cd /home/baadalvm/eventapp/backend

python3 << 'EOF'
import os, django
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'confhub.settings')
django.setup()

from apps.schedule.models import ScheduleSession
from apps.notifications.fcm import send_to_tokens
from apps.notifications.models import DeviceToken

IST = ZoneInfo("Asia/Kolkata")
now_ist = datetime.now(IST)

tokens = list(DeviceToken.objects.filter(is_active=True).values_list('token', flat=True))

print(f"Sending test session push to {len(tokens)} active tokens...")

send_to_tokens(
    tokens,
    "🔔 Test Upcoming Session Push",
    f"Technical Session 2 is starting in 5 minutes at {now_ist.strftime('%I:%M %p')}. Room: Seminar Hall 2.",
    {"type": "schedule", "session_id": "test"}
)

print("✅ Test session reminder push dispatched successfully!")
EOF



# Reset Meal Passes

```bash
cd /workspaces/eventapp/backend && python -c "
import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'confhub.settings')
django.setup()
from apps.checkins.models import MealPass, MealWindow
w = MealWindow.objects.all().delete()[0]
p = MealPass.objects.all().delete()[0]
print(f'✓ Deleted {w} meal windows')
print(f'✓ Deleted {p} meal passes')
print('✓ Ready for fresh meal testing')
"
```

# And if you also want to reset conference check-ins at the same time:

```bash
cd /workspaces/eventapp/backend && python -c "
import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'confhub.settings')
django.setup()
from apps.checkins.models import CheckIn, MealPass, MealWindow
c = CheckIn.objects.all().delete()[0]
w = MealWindow.objects.all().delete()[0]
p = MealPass.objects.all().delete()[0]
print(f'✓ Deleted {c} check-ins')
print(f'✓ Deleted {w} meal windows')
print(f'✓ Deleted {p} meal passes')
print('✓ Everything reset — fresh start')
"
```

### Reset connection between Participants,
```bash
python3 manage.py shell <<'EOF'
from django.contrib.auth import get_user_model
from django.db.models import Q
from apps.chat.models import Conversation, ConnectionRequest

User = get_user_model()

EMAIL_1 = "sudhanshu.stu@gmail.com"
EMAIL_2 = "test@iitd.ac.in"

try:
    u1 = User.objects.get(email=EMAIL_1)
    u2 = User.objects.get(email=EMAIL_2)
except User.DoesNotExist:
    print("User not found.")
    print("Available users:")
    for email in User.objects.values_list("email", flat=True).order_by("email"):
        print(" -", email)
    raise SystemExit(1)

# Find shared conversations using reverse relation names on User
u1_conv_ids = set(u1.conversations_as_a.values_list("id", flat=True)) | set(u1.conversations_as_b.values_list("id", flat=True))
u2_conv_ids = set(u2.conversations_as_a.values_list("id", flat=True)) | set(u2.conversations_as_b.values_list("id", flat=True))
shared_conv_ids = u1_conv_ids & u2_conv_ids

convs = Conversation.objects.filter(id__in=shared_conv_ids)
reqs = ConnectionRequest.objects.filter(
    Q(sender=u1, receiver=u2) | Q(sender=u2, receiver=u1)
)

c_count = convs.count()
r_count = reqs.count()

print(f"Found {c_count} conversation(s)")
print(f"Found {r_count} connection request(s)")

convs.delete()
reqs.delete()

print("Reset complete.")
print("Next interaction should behave like a fresh connection/contact-card flow.")
EOF
```

### If you want a different pair
Replace these two lines:

```python
EMAIL_1 = "sudhanshu.stu@gmail.com"
EMAIL_2 = "test@iitd.ac.in"
```




cd /home/baadalvm/eventapp/mobile && NODE_TLS_REJECT_UNAUTHORIZED=0 npx eas build --profile development --platform android
NODE_TLS_REJECT_UNAUTHORIZED=0 npx eas build --profile development --platform ios

Stack:

Signaling: Django Channels + Redis (already running) — WebSocket
TURN/STUN: coturn (apt package, open source) — system service on VM
Mobile: react-native-webrtc (open source) — needs one EAS rebuild
Alert: Existing Expo Push Notification system



# Reset Manual Registation Count

```bash

python3 manage.py shell -c "
from apps.accounts.models import User
# Delete all test participants whose registration IDs start with 'ETD-2026-S-'
deleted_count = User.objects.filter(role='participant', registration_id__startswith='ETD-2026-S-').delete()
print(f'Purged {deleted_count[0]} test participant(s). The next manual registration ID is now reset to: ETD-2026-S-001')
"

```


tail -f /home/baadalvm/eventapp/backend/server.log