import re

with open("apps/accounts/admin_views.py", "r") as f:
    code = f.read()

# 1. Update participants_upload to pass existing_categories and handle default_category
old_upload = """        objs = [ParticipantImport(uploaded_by=request.user, **row) for row in rows]
        ParticipantImport.objects.bulk_create(objs, ignore_conflicts=False)"""

new_upload = """        default_cat = request.POST.get('default_category', '').strip() or 'Participant'
        objs = []
        for r in rows:
            if not r.get('imported_role') and not getattr(r, 'category', None):
                r['imported_role'] = default_cat
            objs.append(ParticipantImport(uploaded_by=request.user, **r))
        ParticipantImport.objects.bulk_create(objs, ignore_conflicts=False)"""

code = code.replace(old_upload, new_upload)

old_upload_render = "return render(request, 'panel/participants_upload.html')"
new_upload_render = """existing_cats = list(filter(None, set(User.objects.values_list('category', flat=True).distinct())))
    default_cats = ['Participant', 'Sponsor Delegate', 'Invited Guest', 'Keynote Speaker', 'Organizing Team', 'VIP Guest']
    all_cats = sorted(list(set(default_cats + existing_cats)))
    return render(request, 'panel/participants_upload.html', {'categories': all_cats})"""

code = code.replace(old_upload_render, new_upload_render)


# 2. Allow shared Registration IDs during import & assign dynamic category
old_reg_check = """        if staged.registration_id and User.objects.filter(registration_id=staged.registration_id).exists():
            staged.status     = 'failed'
            staged.error_note = 'Registration ID already exists.'
            staged.save(update_fields=['status', 'error_note'])
            skipped_count += 1
            continue"""

new_reg_check = "# Registration ID duplicate check removed to allow shared group/sponsor IDs"

code = code.replace(old_reg_check, new_reg_check)

# Update User creation role and category assignment
old_user_create = """                    registration_id = staged.registration_id or None,
                    role            = 'sponsor_del' if staged.imported_role.lower().startswith('sponsor') else 'participant',
                    must_change_password = True,"""

new_user_create = """                    registration_id = staged.registration_id or None,
                    category        = getattr(staged, 'category', '') or staged.imported_role or 'Participant',
                    role            = 'sponsor_del' if 'sponsor' in (staged.imported_role or '').lower() else 'participant',
                    must_change_password = True,"""

code = code.replace(old_user_create, new_user_create)


# 3. Update participants_list query to include all users
old_list_qs = "qs = User.objects.filter(role__in=['participant', 'sponsor_del', 'guest', 'invited_guest']).order_by('first_name', 'last_name')"
new_list_qs = "qs = User.objects.exclude(role='super_admin').order_by('first_name', 'last_name')"

code = code.replace(old_list_qs, new_list_qs)

with open("apps/accounts/admin_views.py", "w") as f:
    f.write(code)

print("✅ Patched apps/accounts/admin_views.py successfully!")
