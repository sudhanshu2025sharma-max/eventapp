import re
import os

# 1. Update views.py (Fix scan_meal UUID logic and add Directory API)
with open('apps/checkins/views.py', 'r') as f:
    views_code = f.read()

# Fix scan_meal
old_scan_meal = '''    user_id = request.data.get("user_id")
    if user_id:
        target_user = User.objects.filter(id=user_id).first()
    else:
        users = list(User.objects.filter(models.Q(registration_id__iexact=raw_qr) | models.Q(email__iexact=raw_qr)))'''

new_scan_meal = '''    user_id = request.data.get("user_id")
    target_user = None
    if user_id:
        target_user = User.objects.filter(id=user_id).first()
    elif len(raw_qr) == 36 and '-' in raw_qr:
        target_user = User.objects.filter(id=raw_qr).first()

    if not target_user:
        users = list(User.objects.filter(models.Q(registration_id__iexact=raw_qr) | models.Q(email__iexact=raw_qr)))'''

views_code = views_code.replace(old_scan_meal, new_scan_meal)

# Add Directory API
if 'def all_participants_directory(' not in views_code:
    directory_api = '''

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def all_participants_directory(request):
    """API for the mobile app People tab to list all users, categories, and credentials."""
    qs = User.objects.filter(is_active=True).exclude(role='super_admin')
    
    # Calculate stats
    total = qs.count()
    checked_in = CheckIn.objects.filter(checkin_type='conference').count()
    
    # Get categories
    categories = list(qs.exclude(category='').values_list('category', flat=True).distinct())
    if not categories:
        # Fallback to roles if no custom categories exist
        categories = list(qs.values_list('role', flat=True).distinct())
    
    # Fetch Users
    users_data = []
    for u in qs.order_by('first_name')[:500]: # Limit to 500 for mobile performance, rely on search for others
        users_data.append({
            "id": str(u.id),
            "name": u.get_full_name() or u.email,
            "email": u.email,
            "registration_id": u.registration_id or '',
            "category": u.category or u.get_role_display(),
            "temp_password": u.temp_password if u.must_change_password else "(Password Changed)",
            "photo": u.profile_photo.url if getattr(u, 'profile_photo', None) else None
        })
        
    return Response({
        "success": True,
        "stats": {"total": total, "checked_in": checked_in},
        "categories": sorted(categories),
        "users": users_data
    })
'''
    views_code += directory_api

with open('apps/checkins/views.py', 'w') as f:
    f.write(views_code)


# 2. Update urls.py
with open('apps/checkins/urls.py', 'r') as f:
    urls_code = f.read()

if 'all_participants_directory' not in urls_code:
    urls_code = urls_code.replace(
        "path('participants/', views.checked_in_participants, name='checked_in_participants'),",
        "path('participants/', views.checked_in_participants, name='checked_in_participants'),\n    path('participants-dir/', views.all_participants_directory, name='all_participants_directory'),"
    )
    with open('apps/checkins/urls.py', 'w') as f:
        f.write(urls_code)

print("Backend APIs updated successfully.")
