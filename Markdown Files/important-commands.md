# Start App in this sequence

# 1. Docker
cd /workspaces/eventapp && docker compose up -d

# 2. Django
cd /workspaces/eventapp/backend && python manage.py runserver 0.0.0.0:8000

# 3. ngrok (must be running — web uses it too now)
ngrok http 8000

# 4. Expo
cd /workspaces/eventapp/mobile && npx expo start --tunnel --port 8081 --clear

# 5 Kill Port
kill -9 $(lsof -t -i:<PORT>)

# See Reminders logs
tail -f /tmp/session_reminders.log 

Context Gen: Okay its working Now give me the full context to start a new chat with new feature to be build it must cover everything till now and i give you early. 
Now fundamentally everything is working fine we wont polishing so give me a full detailed context window in which you have to write everything that has done so far form first chat to last so that new chat have context of everything also mention the custom template folder how its link how other files are linked and how everything is working and wired up so give me context window for new chat.

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