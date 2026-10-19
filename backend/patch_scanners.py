import re

# Update views.py
with open('apps/checkins/views.py', 'r') as f:
    content = f.read()

# Make sure UUID matching is checked for raw_code in scan_checkin and scan_meal
new_scan_checkin = '''def scan_checkin(request):
    raw_code = request.data.get('registration_id') or request.data.get('qr_data') or request.data.get('qr_code') or ''
    raw_code = str(raw_code).strip()
    user_id = request.data.get("user_id")
    
    target_user = None
    if user_id:
        target_user = User.objects.filter(id=user_id).first()
    elif len(raw_code) == 36 and '-' in raw_code:
        target_user = User.objects.filter(id=raw_code).first()

    if not target_user:
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
                    "category": getattr(u, "category", "") or u.get_role_display(), 
                    "temp_password": getattr(u, "temp_password", "") if getattr(u, "must_change_password", False) else "Changed"
                } for u in users]
            })
        target_user = users[0] if users else None'''

content = re.sub(r'def scan_checkin\(request\):[\s\S]*?target_user = users\[0\] if users else None', new_scan_checkin, content)

with open('apps/checkins/views.py', 'w') as f:
    f.write(content)

print("Updated views.py successfully")
