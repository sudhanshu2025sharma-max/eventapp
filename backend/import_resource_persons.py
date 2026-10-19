import os, sys, csv, re, random, django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'confhub.settings')
django.setup()

from apps.accounts.models import User

def clean_name_string(raw):
    # Remove salutations like Prof., Dr., Mr., Mrs., Ms.
    cleaned = re.sub(r'^(prof\.|dr\.|mr\.|mrs\.|ms\.|shri|smt\.)\s*', '', str(raw).strip(), flags=re.I)
    return cleaned.strip()

def generate_pwd(full_name):
    clean = re.sub(r'[^a-zA-Z\s]', '', str(full_name)).strip()
    parts = clean.split()
    base_str = ""
    for p in parts:
        if len(p) > 2:
            base_str = p
            break
    if not base_str:
        base_str = parts[0] if parts else "User"
    base_str = base_str.capitalize()
    if len(base_str) < 4:
        base_str = base_str.ljust(4, 'x')
    return f"{base_str}@{random.randint(100, 999)}"

def import_resource_persons(csv_file_path):
    if not os.path.exists(csv_file_path):
        print(f"❌ Error: File '{csv_file_path}' not found!")
        return

    with open(csv_file_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    print(f"📊 Processing {len(rows)} Resource Person records from CSV...\n")

    updated_seeded_count = 0
    created_new_count = 0
    credentials_list = []

    for idx, r in enumerate(rows, start=1):
        salutation = (r.get('Salutation') or '').strip()
        raw_full_name = (r.get('Full Name') or r.get('full_name') or r.get('Name') or '').strip()
        reg_id = (r.get('Registration ID') or r.get('registration_id') or f"ETD-2026-RP{idx:03d}").strip()
        email = (r.get('Email ID') or r.get('email') or '').strip().lower()
        gender = (r.get('Gender') or '').strip()
        designation = (r.get('Designation') or '').strip()
        organisation = (r.get('Organisation / Institute') or r.get('organisation') or '').strip()
        mobile = (r.get('Mobile Number') or r.get('mobile') or '').strip()
        address = (r.get('Address') or '').strip()
        category_role = (r.get('Role') or r.get('category') or 'Resource Person').strip()

        if not raw_full_name:
            continue

        clean_name = clean_name_string(raw_full_name)
        parts = clean_name.split()
        first_name = parts[0] if parts else clean_name
        last_name = ' '.join(parts[1:]) if len(parts) > 1 else ''

        # Search for existing user by Email OR fuzzy Name match among Seeded Speakers / Users
        user = None
        if email:
            user = User.objects.filter(email__iexact=email).first()

        if not user:
            # Match against seeded speakers by first name and last name
            user = User.objects.filter(
                role='speaker',
                first_name__iexact=first_name,
                last_name__iexact=last_name
            ).first()

        if not user and len(parts) > 1:
            user = User.objects.filter(
                role='speaker',
                first_name__icontains=first_name
            ).first()

        temp_pwd = generate_pwd(clean_name)

        if user:
            # Match found — Update Seeded Speaker / User
            if email:
                user.email = email
            user.first_name = first_name
            user.last_name = last_name
            user.registration_id = reg_id
            user.designation = designation or user.designation
            user.affiliation = organisation or user.affiliation
            user.gender = gender or user.gender
            user.phone = mobile or user.phone
            user.category = category_role or 'Resource Person'
            
            # Keep active password or set temporary password if mandatory reset active
            if getattr(user, 'must_change_password', True) or not user.temp_password:
                user.set_password(temp_pwd)
                user.temp_password = temp_pwd
                user.must_change_password = True

            user.save()
            updated_seeded_count += 1
            active_pass = user.temp_password or temp_pwd
            print(f"✅ UPDATED SEEDED SPEAKER [{reg_id}]: {raw_full_name} -> {email} | Category: {category_role} | Pwd: {active_pass}")

        else:
            # No match found — Create New Resource Person
            if not email:
                # Generate fallback email if missing in file
                slug_name = re.sub(r'[^a-z0-9]', '', clean_name.lower())
                email = f"{slug_name}@etd2026.iitd.ac.in"

            user = User.objects.create_user(
                email=email,
                password=temp_pwd,
                first_name=first_name,
                last_name=last_name,
                registration_id=reg_id,
                designation=designation,
                affiliation=organisation,
                gender=gender,
                phone=mobile,
                role='participant',
                category=category_role or 'Resource Person',
                temp_password=temp_pwd,
                must_change_password=True,
                is_active=True
            )
            created_new_count += 1
            active_pass = temp_pwd
            print(f"➕ CREATED NEW RESOURCE PERSON [{reg_id}]: {raw_full_name} -> {email} | Category: {category_role} | Pwd: {active_pass}")

        credentials_list.append([
            reg_id, raw_full_name, email, category_role, designation, organisation, mobile, active_pass
        ])

    # Export Credentials to CSV
    out_csv = "resource_persons_credentials.csv"
    with open(out_csv, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['Registration ID', 'Full Name', 'Email ID', 'Category / Role', 'Designation', 'Organisation', 'Mobile Number', 'Temporary Password'])
        writer.writerows(credentials_list)

    print("\n" + "═"*70)
    print(f"🎉 IMPORT COMPLETE SUMMARY:")
    print(f"   • Updated Seeded Speakers: {updated_seeded_count}")
    print(f"   • Created New Resource Persons: {created_new_count}")
    print(f"   • Total Processed: {len(credentials_list)}")
    print(f"   • Credentials CSV saved to: {os.path.abspath(out_csv)}")
    print("═"*70)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 import_resource_persons.py <path_to_your_csv_file>")
    else:
        import_resource_persons(sys.argv[1])
