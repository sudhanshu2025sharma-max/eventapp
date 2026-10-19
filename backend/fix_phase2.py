import os
import sys
import re
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'confhub.settings')
django.setup()

from apps.accounts.models import User
from django.db import models

print("1. Assigning Registration IDs for OT and Speakers...")
# Organizers - using staff_profile__order
ot_users = User.objects.filter(role='staff').order_by('staff_profile__order', 'id')
for i, u in enumerate(ot_users, start=1):
    u.registration_id = f"ETD-2026-OT{i:02d}"
    u.save(update_fields=['registration_id'])
print(f"   - Assigned IDs to {ot_users.count()} Organizing Team members.")

# Speakers
speakers = User.objects.filter(role='speaker').order_by('id')
for i, u in enumerate(speakers, start=1):
    u.registration_id = f"ETD-2026-SPK{i:02d}"
    u.save(update_fields=['registration_id'])
print(f"   - Assigned IDs to {speakers.count()} Speakers.")


print("\n2. Patching apps/accounts/admin_views.py for password rules and custom category support...")
with open("apps/accounts/admin_views.py", "r") as f:
    av_code = f.read()

# Clean up helper for temp password
new_pwd_func = '''def _generate_temp_password(full_name=''):
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
'''

av_code = re.sub(r'def _generate_temp_password\(.*?\n(?:    .*?\n)+', new_pwd_func + '\n', av_code)

with open("apps/accounts/admin_views.py", "w") as f:
    f.write(av_code)
print("   - Patched apps/accounts/admin_views.py")


print("\n3. Patching apps/checkins/views.py for shared Reg IDs support...")
with open("apps/checkins/views.py", "r") as f:
    cv_code = f.read()

scan_checkin_patched = '''@api_view(['POST'])
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
        return Response({"success": False, "error": f"Participant '{raw_code}' not found."}, status=404)

    checkin, created = CheckIn.objects.get_or_create(
        user=target_user,
        checkin_type='conference',
        defaults={'scanned_by': request.user, 'goodies_status': 'pending'}
    )
    
    if created:
        try:
            award_points(target_user, 'checkin', 'Conference check-in bonus')
        except Exception:
            pass

    return Response({
        "success": True,
        "status": "success",
        "created": created,
        "message": f"{target_user.get_full_name()} checked in successfully!",
        "user": _user_detail(target_user, request),
        "goodies_status": getattr(checkin, 'goodies_status', 'pending'),
        "scanned_at": checkin.scanned_at.isoformat() if checkin.scanned_at else None,
    })'''

cv_code = re.sub(r'@api_view\(\[\'POST\'\]\)\n@permission_classes\(\[IsAuthenticated\]\)\ndef scan_checkin\(request\):.*?(?=\n@api_view|\Z)', scan_checkin_patched + '\n\n', cv_code, flags=re.DOTALL)

scan_meal_patched = '''@api_view(['POST'])
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
        target_user = users[0] if users else None

    if not target_user:
        return Response({"success": False, "error": f"Participant '{raw_qr}' not found."}, status=404)

    is_checked_in = CheckIn.objects.filter(user=target_user, checkin_type='conference').exists()
    if not is_checked_in:
        return Response({
            "success": False, 
            "error": f"Not Checked-In! {target_user.get_full_name()} must check in at registration desk first."
        }, status=400)

    today = timezone.now().astimezone(IST).date()
    window = MealWindow.objects.filter(date=today).order_by('-id').first()
    if not window or not window.is_open:
        return Response({"success": False, "error": "No active dining service is currently open."}, status=400)

    active_meal_name = window.meal_type or "Meal"

    existing_scan = MealPass.objects.filter(user=target_user, date=today, meal_type=active_meal_name, used=True).first()
    if existing_scan:
        time_str = existing_scan.used_at.astimezone(IST).strftime('%I:%M %p') if existing_scan.used_at else ""
        return Response({
            "success": False,
            "error": f"Already Redeemed at {time_str}",
            "message": f"{target_user.get_full_name()} already redeemed {active_meal_name} at {time_str}."
        }, status=400)

    meal_pass = MealPass.objects.filter(user=target_user, date=today, meal_type=active_meal_name, used=False).first()
    if not meal_pass:
        meal_pass = MealPass(user=target_user, date=today, meal_type=active_meal_name, is_active=True)
    
    meal_pass.used = True
    meal_pass.used_at = timezone.now()
    meal_pass.scanned_by = request.user
    meal_pass.save()

    try:
        award_points(target_user, 'meal_checkin', f"Attended {meal_pass.meal_type} service")
    except Exception:
        pass

    return Response({
        "success": True,
        "status": "success",
        "message": f"✅ {active_meal_name} approved for {target_user.get_full_name()}!"
    }, status=200)'''

cv_code = re.sub(r'@api_view\(\[\'POST\'\]\)\n@permission_classes\(\[IsAuthenticated\]\)\ndef scan_meal\(request\):.*?(?=\n@api_view|\Z)', scan_meal_patched + '\n\n', cv_code, flags=re.DOTALL)

with open("apps/checkins/views.py", "w") as f:
    f.write(cv_code)
print("   - Patched apps/checkins/views.py cleanly.")

print("\n4. Patching apps/checkins/admin_views.py for Web Admin scanner...")
with open("apps/checkins/admin_views.py", "r") as f:
    cav_code = f.read()

panel_scan_patched = '''@csrf_exempt
@login_required
@module_required('checkin_scanner')
def panel_scan(request):
    if request.method != 'POST':
        return JsonResponse({"success": False, "message": "POST required"}, status=405)
    try:
        data = json.loads(request.body.decode('utf-8'))
    except Exception:
        data = request.POST
    code = str(data.get('registration_id') or data.get('qr_data') or data.get('qr_code') or '').strip()
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
        target_user = users[0] if users else None

    if not target_user:
        return JsonResponse({"success": False, "message": "Participant not found"}, status=404)
    checkin, created = CheckIn.objects.get_or_create(
        user=target_user, checkin_type='conference',
        defaults={'scanned_by': request.user},
    )
    return JsonResponse({
        "success": True,
        "already_checked_in": not created,
        "message": f"{target_user.get_full_name() or target_user.email} checked in successfully!",
        "user": {
            "name": target_user.get_full_name() or target_user.email,
            "email": target_user.email,
            "registration_id": getattr(target_user, 'registration_id', '') or '',
            "goodies_status": checkin.goodies_status,
        },
    })'''

cav_code = re.sub(r'@csrf_exempt\n@login_required\n@module_required\(\'checkin_scanner\'\)\ndef panel_scan\(request\):.*?(?=\n@csrf_exempt|\Z)', panel_scan_patched + '\n\n', cav_code, flags=re.DOTALL)

panel_meal_scan_patched = '''@csrf_exempt
@login_required
@module_required('meal_scanner')
def panel_meal_scan(request):
    if request.method != 'POST':
        return JsonResponse({"success": False, "message": "POST required"}, status=405)
    import json
    try:
        data = json.loads(request.body.decode('utf-8'))
    except Exception:
        data = request.POST
    
    raw_qr = str(data.get('qr_data') or data.get('qr_code') or data.get('registration_id') or '').strip()
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
        target_user = users[0] if users else None

    if not target_user:
        return JsonResponse({"success": False, "message": "Participant not found. Invalid ID."}, status=404)

    is_checked_in = CheckIn.objects.filter(user=target_user, checkin_type='conference').exists()
    if not is_checked_in:
        return JsonResponse({"success": False, "message": "Not Checked-In! User must check into the conference first."}, status=400)

    today = timezone.now().astimezone(IST).date()
    window = MealWindow.objects.filter(date=today).order_by('-id').first()
    if not window or not window.is_open:
        return JsonResponse({"success": False, "message": "No active dining service is currently open."}, status=400)

    active_meal_name = window.meal_type or "Meal"

    existing_scan = MealPass.objects.filter(user=target_user, date=today, meal_type=active_meal_name, used=True).first()
    if existing_scan:
        time_str = existing_scan.used_at.astimezone(IST).strftime('%I:%M %p') if existing_scan.used_at else ""
        return JsonResponse({"success": False, "message": f"Already Redeemed at {time_str}"}, status=400)

    meal_pass = MealPass.objects.filter(user=target_user, date=today, meal_type=active_meal_name, used=False).first()
    if not meal_pass:
        meal_pass = MealPass(user=target_user, date=today, meal_type=active_meal_name, is_active=True)
    
    meal_pass.used = True
    meal_pass.used_at = timezone.now()
    meal_pass.scanned_by = request.user
    meal_pass.save()

    return JsonResponse({
        "success": True,
        "message": f"✅ {active_meal_name} approved for {target_user.get_full_name() or target_user.email}!"
    })'''

cav_code = re.sub(r'@csrf_exempt\n@login_required\n@module_required\(\'meal_scanner\'\)\ndef panel_meal_scan\(request\):.*?(?=\n@login_required|\Z)', panel_meal_scan_patched + '\n\n', cav_code, flags=re.DOTALL)

with open("apps/checkins/admin_views.py", "w") as f:
    f.write(cav_code)
print("   - Patched apps/checkins/admin_views.py cleanly.")

print("\n🎉 All fixes applied successfully!")
