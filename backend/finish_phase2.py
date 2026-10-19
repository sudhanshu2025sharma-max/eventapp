import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'confhub.settings')
django.setup()

from apps.accounts.models import User

print("1. Verifying OT and Speaker Registration IDs...")
ot_count = User.objects.filter(role='staff', registration_id__startswith='ETD-2026-OT').count()
spk_count = User.objects.filter(role='speaker', registration_id__startswith='ETD-2026-SPK').count()
print(f"   - Verified {ot_count} OT members and {spk_count} Speakers have IDs assigned.")


print("\n2. Updating apps/accounts/admin_views.py...")
with open("apps/accounts/admin_views.py", "r") as f:
    lines = f.readlines()

new_lines = []
in_gen_func = False

for line in lines:
    if line.startswith("def _generate_temp_password("):
        in_gen_func = True
        new_lines.append("def _generate_temp_password(full_name=''):\n")
        new_lines.append("    import re, random\n")
        new_lines.append("    clean = re.sub(r'[^a-zA-Z\\s]', '', str(full_name)).strip()\n")
        new_lines.append("    parts = clean.split()\n")
        new_lines.append("    base_str = ''\n")
        new_lines.append("    is_short = False\n")
        new_lines.append("    for p in parts:\n")
        new_lines.append("        if len(p) > 2:\n")
        new_lines.append("            base_str = p\n")
        new_lines.append("            break\n")
        new_lines.append("    if not base_str:\n")
        new_lines.append("        base_str = parts[0] if parts else 'User'\n")
        new_lines.append("        is_short = True\n")
        new_lines.append("    base_str = base_str.capitalize()\n")
        new_lines.append("    if len(base_str) < 4:\n")
        new_lines.append("        base_str = base_str.ljust(4, 'x')\n")
        new_lines.append("        is_short = True\n")
        new_lines.append("    return f'{base_str}@{random.randint(100, 999)}', is_short\n\n")
        continue

    if in_gen_func:
        if line.startswith("def ") or line.startswith("@"):
            in_gen_func = False
        else:
            continue

    new_lines.append(line)

av_code = "".join(new_lines)

# Fix callers of _generate_temp_password
av_code = av_code.replace(
    "temp_password = manual_pwd if manual_pwd else _generate_temp_password(staged.full_name)",
    "auto_pwd, _ = _generate_temp_password(staged.full_name)\n        temp_password = manual_pwd if manual_pwd else auto_pwd"
)

av_code = av_code.replace(
    "temp_password = _generate_temp_password(full_name)",
    "manual_pwd = request.POST.get('temp_password', '').strip()\n        auto_pwd, is_short = _generate_temp_password(full_name)\n        temp_password = manual_pwd if manual_pwd else auto_pwd"
)

with open("apps/accounts/admin_views.py", "w") as f:
    f.write(av_code)
print("   - Successfully updated apps/accounts/admin_views.py")


print("\n3. Patching apps/checkins/views.py...")
with open("apps/checkins/views.py", "r") as f:
    cv_code = f.read()

# Replace scan_checkin
old_scan_checkin = """@api_view(['POST'])
@permission_classes([IsAuthenticated])
def scan_checkin(request):
    raw_code = request.data.get('registration_id') or request.data.get('qr_data') or request.data.get('qr_code') or ''
    raw_code = str(raw_code).strip()
    target_user = User.objects.filter(models.Q(registration_id__iexact=raw_code) | models.Q(email__iexact=raw_code)).first()
    if not target_user:
        return Response({"success": False, "error": f"Participant '{raw_code}' not found."}, status=404)"""

new_scan_checkin = """@api_view(['POST'])
@permission_classes([IsAuthenticated])
def scan_checkin(request):
    raw_code = request.data.get('registration_id') or request.data.get('qr_data') or request.data.get('qr_code') or ''
    raw_code = str(raw_code).strip()
    user_id = request.data.get('user_id')

    if user_id:
        target_user = User.objects.filter(id=user_id).first()
    else:
        users = list(User.objects.filter(models.Q(registration_id__iexact=raw_code) | models.Q(email__iexact=raw_code)))
        if len(users) > 1:
            return Response({
                "success": True,
                "multiple": True,
                "users": [{
                    "id": str(u.id),
                    "name": u.get_full_name() or u.email,
                    "email": u.email,
                    "registration_id": getattr(u, 'registration_id', '') or '',
                    "category": getattr(u, 'category', '') or u.get_role_display(),
                    "temp_password": getattr(u, 'temp_password', '') if getattr(u, 'must_change_password', False) else "Changed"
                } for u in users]
            })
        target_user = users[0] if users else None

    if not target_user:
        return Response({"success": False, "error": f"Participant '{raw_code}' not found."}, status=404)"""

if old_scan_checkin in cv_code:
    cv_code = cv_code.replace(old_scan_checkin, new_scan_checkin)
    print("   - Replaced scan_checkin in apps/checkins/views.py")

# Replace scan_meal
old_scan_meal = """@api_view(['POST'])
@permission_classes([IsAuthenticated])
def scan_meal(request):
    raw_qr = request.data.get('qr_data') or request.data.get('qr_code') or request.data.get('registration_id') or ''
    raw_qr = str(raw_qr).strip()

    target_user = User.objects.filter(models.Q(registration_id__iexact=raw_qr) | models.Q(email__iexact=raw_qr)).first()"""

new_scan_meal = """@api_view(['POST'])
@permission_classes([IsAuthenticated])
def scan_meal(request):
    raw_qr = request.data.get('qr_data') or request.data.get('qr_code') or request.data.get('registration_id') or ''
    raw_qr = str(raw_qr).strip()
    user_id = request.data.get('user_id')

    if user_id:
        target_user = User.objects.filter(id=user_id).first()
    else:
        users = list(User.objects.filter(models.Q(registration_id__iexact=raw_qr) | models.Q(email__iexact=raw_qr)))
        if not users:
            try:
                import uuid
                pass_uuid = uuid.UUID(raw_qr)
                fallback_pass = MealPass.objects.filter(id=pass_uuid).first()
                if fallback_pass and fallback_pass.user:
                    users = [fallback_pass.user]
            except Exception:
                pass
        if len(users) > 1:
            return Response({
                "success": True,
                "multiple": True,
                "users": [{
                    "id": str(u.id),
                    "name": u.get_full_name() or u.email,
                    "email": u.email,
                    "registration_id": getattr(u, 'registration_id', '') or '',
                    "category": getattr(u, 'category', '') or u.get_role_display(),
                    "temp_password": getattr(u, 'temp_password', '') if getattr(u, 'must_change_password', False) else "Changed"
                } for u in users]
            })
        target_user = users[0] if users else None"""

if old_scan_meal in cv_code:
    cv_code = cv_code.replace(old_scan_meal, new_scan_meal)
    print("   - Replaced scan_meal in apps/checkins/views.py")

with open("apps/checkins/views.py", "w") as f:
    f.write(cv_code)


print("\n4. Patching apps/checkins/admin_views.py...")
with open("apps/checkins/admin_views.py", "r") as f:
    cav_code = f.read()

old_panel_scan = """code = str(data.get('registration_id') or data.get('qr_data') or data.get('qr_code') or '').strip()
    target_user = User.objects.filter(
        models.Q(registration_id=code) | models.Q(email__iexact=code)
    ).first()"""

new_panel_scan = """code = str(data.get('registration_id') or data.get('qr_data') or data.get('qr_code') or '').strip()
    user_id = data.get('user_id')

    if user_id:
        target_user = User.objects.filter(id=user_id).first()
    else:
        users = list(User.objects.filter(models.Q(registration_id__iexact=code) | models.Q(email__iexact=code)))
        if len(users) > 1:
            return JsonResponse({
                "success": True,
                "multiple": True,
                "users": [{
                    "id": str(u.id),
                    "name": u.get_full_name() or u.email,
                    "email": u.email,
                    "registration_id": getattr(u, 'registration_id', '') or '',
                    "category": getattr(u, 'category', '') or u.get_role_display(),
                    "temp_password": getattr(u, 'temp_password', '') if getattr(u, 'must_change_password', False) else "Changed"
                } for u in users]
            })
        target_user = users[0] if users else None"""

if old_panel_scan in cav_code:
    cav_code = cav_code.replace(old_panel_scan, new_panel_scan)
    print("   - Replaced panel_scan in apps/checkins/admin_views.py")

old_panel_meal_scan = """raw_qr = str(data.get('qr_data') or data.get('qr_code') or data.get('registration_id') or '').strip()
    
    target_user = User.objects.filter(models.Q(registration_id__iexact=raw_qr) | models.Q(email__iexact=raw_qr)).first()"""

new_panel_meal_scan = """raw_qr = str(data.get('qr_data') or data.get('qr_code') or data.get('registration_id') or '').strip()
    user_id = data.get('user_id')

    if user_id:
        target_user = User.objects.filter(id=user_id).first()
    else:
        users = list(User.objects.filter(models.Q(registration_id__iexact=raw_qr) | models.Q(email__iexact=raw_qr)))
        if not users:
            try:
                import uuid
                pass_uuid = uuid.UUID(raw_qr)
                fallback_pass = MealPass.objects.filter(id=pass_uuid).first()
                if fallback_pass and fallback_pass.user:
                    users = [fallback_pass.user]
            except Exception:
                pass
        if len(users) > 1:
            return JsonResponse({
                "success": True,
                "multiple": True,
                "users": [{
                    "id": str(u.id),
                    "name": u.get_full_name() or u.email,
                    "email": u.email,
                    "registration_id": getattr(u, 'registration_id', '') or '',
                    "category": getattr(u, 'category', '') or u.get_role_display(),
                    "temp_password": getattr(u, 'temp_password', '') if getattr(u, 'must_change_password', False) else "Changed"
                } for u in users]
            })
        target_user = users[0] if users else None"""

if old_panel_meal_scan in cav_code:
    cav_code = cav_code.replace(old_panel_meal_scan, new_panel_meal_scan)
    print("   - Replaced panel_meal_scan in apps/checkins/admin_views.py")

with open("apps/checkins/admin_views.py", "w") as f:
    f.write(cav_code)

print("\n🎉 Phase 2 backend patching complete!")
