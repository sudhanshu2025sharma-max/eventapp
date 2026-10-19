import os, csv, io, sys, django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'confhub.settings')
django.setup()

from apps.accounts.models import User
from apps.accounts.admin_views import _generate_temp_password

def sync_speakers_from_csv(csv_path_or_text):
    """
    Matches seeded speakers by Name, fills missing Email and Registration ID,
    assigns sub-category (e.g., Session Chair, Keynote Speaker),
    and generates a temp password.
    """
    if os.path.exists(csv_path_or_text):
        with open(csv_path_or_text, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
    else:
        reader = csv.DictReader(io.StringIO(csv_path_or_text))
        rows = list(reader)

    updated_count = 0
    created_count = 0

    for r in rows:
        name = (r.get('Full Name') or r.get('full_name') or r.get('Name') or '').strip()
        email = (r.get('Email ID') or r.get('email') or '').strip()
        reg_id = (r.get('Registration ID') or r.get('registration_id') or r.get('reg_id') or '').strip()
        category = (r.get('Category') or r.get('Role') or r.get('category') or 'Keynote Speaker').strip()

        if not name:
            continue

        parts = name.split()
        first_name = parts[0]
        last_name = ' '.join(parts[1:]) if len(parts) > 1 else ''

        # Search for existing seeded speaker by name
        user = User.objects.filter(role='speaker', first_name__iexact=first_name, last_name__iexact=last_name).first()
        if not user:
            user = User.objects.filter(role='speaker', first_name__icontains=first_name).first()

        auto_pwd, _ = _generate_temp_password(name)

        if user:
            # Update seeded speaker with Email, Reg ID, Category & Password
            if email:
                user.email = email
            if reg_id:
                user.registration_id = reg_id
            user.category = category
            if not user.password or user.must_change_password:
                user.set_password(auto_pwd)
                user.temp_password = auto_pwd
                user.must_change_password = True
            user.save()
            updated_count += 1
            print(f"✅ Updated Seeded Speaker: {name} -> Email: {user.email} | Reg ID: {user.registration_id} | Category: {category} | Temp Pass: {auto_pwd}")
        else:
            # Create new speaker if not already seeded
            if email:
                user = User.objects.create_user(
                    email=email,
                    password=auto_pwd,
                    first_name=first_name,
                    last_name=last_name,
                    registration_id=reg_id or None,
                    role='speaker',
                    category=category,
                    temp_password=auto_pwd,
                    must_change_password=True,
                    is_active=True
                )
                created_count += 1
                print(f"➕ Created New Speaker: {name} -> Email: {email} | Category: {category} | Temp Pass: {auto_pwd}")

    print(f"\n🎉 Done! Sync complete. Updated: {updated_count} seeded speakers, Created: {created_count} new speakers.")

if __name__ == '__main__':
    if len(sys.argv) > 1:
        sync_speakers_from_csv(sys.argv[1])
    else:
        print("Usage: python3 sync_seeded_speakers.py <path_to_speaker_csv>")
