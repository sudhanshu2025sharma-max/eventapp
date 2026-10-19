with open('apps/checkins/admin_views.py', 'r') as f:
    content = f.read()

# Update panel_scan
old_panel_scan = '''    if user_id:
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
        target_user = users[0] if users else None'''

new_panel_scan = '''    target_user = None
    if user_id:
        target_user = User.objects.filter(id=user_id).first()
    elif len(code) == 36 and '-' in code:
        target_user = User.objects.filter(id=code).first()

    if not target_user:
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
        target_user = users[0] if users else None'''

if old_panel_scan in content:
    content = content.replace(old_panel_scan, new_panel_scan)
    with open('apps/checkins/admin_views.py', 'w') as f:
        f.write(content)
    print("Updated admin_views.py panel_scan successfully")
else:
    print("old_panel_scan pattern not found, checking...")
