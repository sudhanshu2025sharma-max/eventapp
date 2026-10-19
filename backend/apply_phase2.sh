#!/bin/bash
echo "🚀 Starting Phase 2 System Update..."

# 1. Python script to dynamically patch models.py and accounts/admin_views.py
cat << 'PYEOF' > patch_accounts.py
import os
import re

# --- Patch models.py ---
with open("apps/accounts/models.py", "r") as f:
    models_code = f.read()

if "category =" not in models_code:
    models_code = models_code.replace(
        "role                = models.CharField(max_length=20, choices=Role.choices, default=Role.PARTICIPANT)",
        "role                = models.CharField(max_length=20, choices=Role.choices, default=Role.PARTICIPANT)\n    category            = models.CharField(max_length=100, blank=True, default='')\n    temp_password       = models.CharField(max_length=50, blank=True, default='')"
    )
    models_code = models_code.replace(
        "imported_role   = models.CharField(max_length=20, default='participant')",
        "imported_role   = models.CharField(max_length=20, default='participant')\n    category        = models.CharField(max_length=100, blank=True, default='')"
    )
    with open("apps/accounts/models.py", "w") as f:
        f.write(models_code)
    print("✅ Patched apps/accounts/models.py")

# --- Patch accounts/admin_views.py ---
with open("apps/accounts/admin_views.py", "r") as f:
    av = f.read()

# Replace password generator
new_gen = """def _generate_temp_password(full_name=''):
    import re, random
    clean = re.sub(r'[^a-zA-Z\\s]', '', str(full_name)).strip()
    parts = clean.split()
    base_str = ""
    is_short = False
    for p in parts:
        if len(p) > 2:
            base_str = p
            break
    if not base_str:
        base_str = parts[0] if parts else "User"
        is_short = True
    base_str = base_str.capitalize()
    if len(base_str) < 4:
        base_str = base_str.ljust(4, 'x')
        is_short = True
    return f"{base_str}@{random.randint(100, 999)}", is_short
"""
av = re.sub(r'def _generate_temp_password\(.*?\n(?:    .*?\n)+', new_gen, av)

# Patch callers and Add Participant short-name block
av = av.replace("temp_password = manual_pwd if manual_pwd else _generate_temp_password(staged.full_name)", 
                "auto_pwd, _ = _generate_temp_password(staged.full_name)\n        temp_password = manual_pwd if manual_pwd else auto_pwd")

av = av.replace("temp_password = _generate_temp_password(full_name)", """manual_pwd = request.POST.get('temp_password', '').strip()
        force_pwd = request.POST.get('force_password') == '1'
        auto_pwd, is_short = _generate_temp_password(full_name)
        
        if not manual_pwd and is_short and not force_pwd:
            messages.error(request, f"⚠️ Name is too short. Auto-generated password would be '{auto_pwd}'. Type a custom password or try again.")
            return redirect(request.path)
            
        temp_password = manual_pwd if manual_pwd else auto_pwd""")

# Ensure User receives temp_password and category during creation
av = av.replace("password        = temp_password,", 
                "password        = temp_password,\n                    temp_password   = temp_password,\n                    category        = getattr(staged, 'category', ''),")

with open("apps/accounts/admin_views.py", "w") as f:
    f.write(av)
print("✅ Patched apps/accounts/admin_views.py")
PYEOF
python3 patch_accounts.py

# 2. Assign Organizers and Speakers custom IDs
cat << 'PYEOF' > assign_ids.py
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
PYEOF
python3 assign_ids.py

# 3. Patching checkins/views.py for multiple scans
sed -i 's/target_user = User.objects.filter(models.Q(registration_id__iexact=raw_code) | models.Q(email__iexact=raw_code)).first()/user_id = request.data.get("user_id")\n    if user_id:\n        target_user = User.objects.filter(id=user_id).first()\n    else:\n        users = list(User.objects.filter(models.Q(registration_id__iexact=raw_code) | models.Q(email__iexact=raw_code)))\n        if len(users) > 1:\n            return Response({"success": True, "multiple": True, "users": [{"id": str(u.id), "name": u.get_full_name() or u.email, "email": u.email, "category": getattr(u, "category", "") or getattr(u, "role", ""), "temp_password": getattr(u, "temp_password", "") if getattr(u, "must_change_password", False) else "Changed"} for u in users]})\n        target_user = users[0] if users else None/g' apps/checkins/views.py

sed -i 's/target_user = User.objects.filter(models.Q(registration_id__iexact=raw_qr) | models.Q(email__iexact=raw_qr)).first()/user_id = request.data.get("user_id")\n    if user_id:\n        target_user = User.objects.filter(id=user_id).first()\n    else:\n        users = list(User.objects.filter(models.Q(registration_id__iexact=raw_qr) | models.Q(email__iexact=raw_qr)))\n        if not users:\n            try:\n                import uuid\n                fallback_pass = MealPass.objects.filter(id=uuid.UUID(raw_qr)).first()\n                if fallback_pass and fallback_pass.user: users = [fallback_pass.user]\n            except Exception: pass\n        if len(users) > 1:\n            return Response({"success": True, "multiple": True, "users": [{"id": str(u.id), "name": u.get_full_name() or u.email, "email": u.email, "category": getattr(u, "category", "") or getattr(u, "role", ""), "temp_password": getattr(u, "temp_password", "") if getattr(u, "must_change_password", False) else "Changed"} for u in users]})\n        target_user = users[0] if users else None/g' apps/checkins/views.py

# 4. Patching checkins/admin_views.py for multiple scans
sed -i 's/target_user = User.objects.filter(\n        models.Q(registration_id=code) | models.Q(email__iexact=code)\n    ).first()/user_id = data.get("user_id")\n    if user_id:\n        target_user = User.objects.filter(id=user_id).first()\n    else:\n        users = list(User.objects.filter(models.Q(registration_id=code) | models.Q(email__iexact=code)))\n        if len(users) > 1:\n            return JsonResponse({"success": True, "multiple": True, "users": [{"id": str(u.id), "name": u.get_full_name() or u.email, "email": u.email, "category": getattr(u, "category", "") or getattr(u, "role", ""), "temp_password": getattr(u, "temp_password", "") if getattr(u, "must_change_password", False) else "Changed"} for u in users]})\n        target_user = users[0] if users else None/g' apps/checkins/admin_views.py

sed -i 's/target_user = User.objects.filter(models.Q(registration_id__iexact=raw_qr) | models.Q(email__iexact=raw_qr)).first()/user_id = data.get("user_id")\n    if user_id:\n        target_user = User.objects.filter(id=user_id).first()\n    else:\n        users = list(User.objects.filter(models.Q(registration_id__iexact=raw_qr) | models.Q(email__iexact=raw_qr)))\n        if not users:\n            try:\n                import uuid\n                fallback_pass = MealPass.objects.filter(id=uuid.UUID(raw_qr)).first()\n                if fallback_pass and fallback_pass.user: users = [fallback_pass.user]\n            except Exception: pass\n        if len(users) > 1:\n            return JsonResponse({"success": True, "multiple": True, "users": [{"id": str(u.id), "name": u.get_full_name() or u.email, "email": u.email, "category": getattr(u, "category", "") or getattr(u, "role", ""), "temp_password": getattr(u, "temp_password", "") if getattr(u, "must_change_password", False) else "Changed"} for u in users]})\n        target_user = users[0] if users else None/g' apps/checkins/admin_views.py

echo "✅ Patched checkin scanners API logic."

# 5. Apply database migrations
python3 manage.py makemigrations accounts
python3 manage.py migrate accounts

# 6. Restart Server
pkill -9 -f gunicorn || true && sleep 1.5 && nohup ./start_server.sh > server.log 2>&1 &
echo "✅ Server Restarted."
