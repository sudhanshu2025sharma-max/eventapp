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
