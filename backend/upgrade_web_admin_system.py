import os, sys, re, django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'confhub.settings')
django.setup()

from apps.accounts.models import User

# ── 1. Fix Seeded Speakers: Assign Default Passwords if missing ──
print("1. Ensuring temporary passwords for all seeded speakers...")
speakers = User.objects.filter(role='speaker')
updated_pwds = 0
for spk in speakers:
    if not spk.temp_password or not spk.password:
        clean_name = re.sub(r'[^a-zA-Z\s]', '', spk.get_full_name() or spk.email or "Speaker").strip()
        parts = clean_name.split()
        base_str = parts[0] if parts else "Speaker"
        base_str = base_str.capitalize()
        if len(base_str) < 4:
            base_str = base_str.ljust(4, 'x')
        temp_p = f"{base_str}@123"
        spk.set_password(temp_p)
        spk.temp_password = temp_p
        spk.must_change_password = True
        spk.save(update_fields=['password', 'temp_password', 'must_change_password'])
        updated_pwds += 1

print(f"   - Verified/Generated temp passwords for {speakers.count()} speakers ({updated_pwds} updated).")


# ── 2. Patch Speaker Admin Views to show Passwords & handle Custom Categories ──
speaker_admin_views_path = "apps/speakers/admin_views.py"
if os.path.exists(speaker_admin_views_path):
    with open(speaker_admin_views_path, "r") as f:
        sav = f.read()

    # Add CSV Export for Speakers
    export_speaker_csv_func = """
@login_required
def export_speaker_credentials(request):
    import csv
    from django.http import HttpResponse
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="ETD2026_Speaker_Credentials.csv"'
    writer = csv.writer(response)
    writer.writerow(['Registration ID', 'Full Name', 'Category / Sub-Role', 'Email', 'Designation', 'Organisation', 'Temporary Password'])
    
    speakers = User.objects.filter(role='speaker').order_by('first_name')
    for s in speakers:
        writer.writerow([
            s.registration_id or '',
            s.get_full_name() or '',
            s.category or getattr(s, 'designation', '') or 'Speaker',
            s.email or '',
            s.designation or '',
            s.affiliation or '',
            s.temp_password if s.must_change_password else '(Password Changed)'
        ])
    return response
"""
    if "def export_speaker_credentials" not in sav:
        sav += "\n" + export_speaker_csv_func
        with open(speaker_admin_views_path, "w") as f:
            f.write(sav)
        print("2. Added export_speaker_credentials view to apps/speakers/admin_views.py")

# ── 3. Update Speakers List Template ──
spk_template_path = "templates/panel/speakers_list.html"
if os.path.exists(spk_template_path):
    with open(spk_template_path, "r") as f:
        spk_tpl = f.read()

    # Add CSV Export button to Speakers List Header
    old_btn = '<a href="{% url \'speaker_add\' %}" class="btn btn-primary">'
    new_btn = """<a href="{% url 'speaker_export_credentials' %}" class="btn btn-secondary" style="background:#059669;color:#fff;border-color:#059669;margin-right:8px;">
    <i class="fas fa-file-csv"></i> Export Speaker Logins CSV
  </a>
  <a href="{% url 'speaker_add' %}" class="btn btn-primary">"""

    if old_btn in spk_tpl and "speaker_export_credentials" not in spk_tpl:
        spk_tpl = spk_tpl.replace(old_btn, new_btn)
        with open(spk_template_path, "w") as f:
            f.write(spk_tpl)
        print("3. Added Export Logins CSV button to templates/panel/speakers_list.html")

# ── 4. Ensure URLs registered for Speaker Export ──
speaker_urls_path = "apps/speakers/urls.py"
if os.path.exists(speaker_urls_path):
    with open(speaker_urls_path, "r") as f:
        surls = f.read()

    if "export_speaker_credentials" not in surls:
        surls = surls.replace(
            "urlpatterns = [",
            "urlpatterns = [\n    path('export-credentials/', admin_views.export_speaker_credentials, name='speaker_export_credentials'),"
        )
        with open(speaker_urls_path, "w") as f:
            f.write(surls)
        print("4. Registered speaker_export_credentials URL in apps/speakers/urls.py")

print("🎉 Upgrade Script Complete!")
