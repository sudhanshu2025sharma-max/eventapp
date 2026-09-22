#!/usr/bin/env python3
"""
Seed ETD 2026 Library Staff into the database.
Downloads photos from etd2026.iitd.ac.in via IITD proxy (SSL bypass).
Creates User + StaffProfile + CheckIn records.
Idempotent — safe to run multiple times.
"""
import os, sys, django, requests, urllib3
from io import BytesIO
from django.core.files.base import ContentFile

# ── Bootstrap Django ──
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'confhub.settings')
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

from django.conf import settings
from apps.accounts.models import User, StaffProfile
from apps.checkins.models import CheckIn

# ── Dynamic Conference Model Lookup ──
try:
    Conference = CheckIn._meta.get_field('conference').related_model
    print(f"✅ Dynamically resolved Conference model to: {Conference}")
except Exception as e:
    Conference = None
    print(f"⚠ Could not dynamically resolve Conference model: {e}")

# ── SSL + Proxy Config ──
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
PROXIES = {
    'http':  'http://proxy21.iitd.ac.in:3128',
    'https': 'http://proxy21.iitd.ac.in:3128',
}
BASE_URL = 'https://etd2026.iitd.ac.in'
MEDIA_DIR = os.path.join(settings.MEDIA_ROOT, 'staff')
os.makedirs(MEDIA_DIR, exist_ok=True)

# ── Staff Data (order matches HTML hierarchy) ──
STAFF_DATA = [
    # ── Tier 1: Librarian & Head ──
    {
        'first': 'Nabi', 'last': 'Hasan',
        'email': 'hodlibrary@admin.iitd.ac.in',
        'phone': '+91-11-26591451',
        'designation': 'Librarian & Head',
        'department': 'Central Library, IIT Delhi',
        'tier': 'librarian', 'role': 'team_head',
        'password': 'Librarian@123',
        'photo_path': '/media/team/photos/pic.jpg',
        'linkedin': 'https://www.linkedin.com/in/nabihasaniit',
        'profile': 'http://web.iitd.ac.in/~hasan/',
        'scholar': 'https://scholar.google.co.in/citations?user=-nPiCskAAAAJ',
        'order': 1,
    },
    # ── Tier 2: Deputy Librarians ──
    {
        'first': 'Neeraj Kumar', 'last': 'Chaurasia',
        'email': 'neerajkc@library.iitd.ac.in',
        'phone': '+91-11-26596622',
        'designation': 'Deputy Librarian',
        'department': 'Central Library, IIT Delhi',
        'tier': 'deputy', 'role': 'team_head',
        'password': 'Officer@123',
        'photo_path': '/media/team/photos/neeraj.jpg',
        'linkedin': '', 'profile': 'https://lib.iitd.ac.in/Neeraj-Kumar-Chaurasia',
        'scholar': '', 'order': 2,
    },
    {
        'first': 'Shankar B.', 'last': 'Chavan',
        'email': 'shankar.chavan@library.iitd.ac.in',
        'phone': '+91-11-26591445',
        'designation': 'Deputy Librarian',
        'department': 'Central Library, IIT Delhi',
        'tier': 'deputy', 'role': 'team_head',
        'password': 'Officer@123',
        'photo_path': '/media/team/photos/sbc.jpg',
        'linkedin': '', 'profile': 'http://web.iitd.ernet.in/~shankar.chavan/',
        'scholar': '', 'order': 3,
    },
    # ── Tier 3: Assistant Librarians ──
    {
        'first': 'Vijay Kumar', 'last': 'Verma',
        'email': 'vkverma@library.iitd.ac.in',
        'phone': '+91-11-26596631',
        'designation': 'Assistant Librarian (SG)',
        'department': 'Central Library, IIT Delhi',
        'tier': 'assistant', 'role': 'team_head',
        'password': 'Officer@123',
        'photo_path': '/media/team/photos/vijay_verma.jpg',
        'linkedin': '', 'profile': 'https://web.iitd.ac.in/~vkverma/',
        'scholar': '', 'order': 4,
    },
    {
        'first': 'Vanita', 'last': 'Khanchandani',
        'email': 'vanita@library.iitd.ac.in',
        'phone': '+91-11-26591496',
        'designation': 'Assistant Librarian (SG)',
        'department': 'Central Library, IIT Delhi',
        'tier': 'assistant', 'role': 'team_head',
        'password': 'Officer@123',
        'photo_path': '/media/team/photos/8802925841.JPG',
        'linkedin': '', 'profile': '', 'scholar': '', 'order': 5,
    },
    {
        'first': 'Mohit', 'last': 'Garg',
        'email': 'gargmohit@library.iitd.ac.in',
        'phone': '+91-11-26591467',
        'designation': 'Assistant Librarian (SS)',
        'department': 'Central Library, IIT Delhi',
        'tier': 'assistant', 'role': 'team_head',
        'password': 'Officer@123',
        'photo_path': '/media/team/photos/mohit.png',
        'linkedin': '', 'profile': 'https://web.iitd.ac.in/~gargmohit/',
        'scholar': '', 'order': 6,
    },
    {
        'first': 'Manu T', 'last': 'R',
        'email': 'manutr@library.iitd.ac.in',
        'phone': '+91-11-26596096',
        'designation': 'Assistant Librarian (SS)',
        'department': 'Central Library, IIT Delhi',
        'tier': 'assistant', 'role': 'team_head',
        'password': 'Officer@123',
        'photo_path': '/media/team/photos/IMG_0735.JPG',
        'linkedin': '', 'profile': 'https://web.iitd.ac.in/~manutr/',
        'scholar': '', 'order': 7,
    },
    {
        'first': 'Satbir', 'last': 'Chauhan',
        'email': 'satbir@library.iitd.ac.in',
        'phone': '+91-11-26596876',
        'designation': 'Assistant Librarian',
        'department': 'Central Library, IIT Delhi',
        'tier': 'assistant', 'role': 'team_head',
        'password': 'Officer@123',
        'photo_path': '/media/team/photos/satbir.png',
        'linkedin': '', 'profile': '', 'scholar': '', 'order': 8,
    },
    # ── Tier 4: Staff ──
    {
        'first': 'Gunjan', 'last': 'Mishra',
        'email': 'gunjan0605@library.iitd.ac.in',
        'phone': '+91-11-26596627',
        'designation': 'Library Information Officer',
        'department': 'Electronic Resources Division',
        'tier': 'staff', 'role': 'staff',
        'password': 'Staff@123',
        'photo_path': '/media/team/photos/gunjanmi.jpg',
        'linkedin': '', 'profile': '', 'scholar': '', 'order': 9,
    },
    {
        'first': 'Nizam', 'last': 'Husain',
        'email': 'nizam@library.iitd.ac.in',
        'phone': '+91-11-26596652',
        'designation': 'Sr. Library Information Assistant',
        'department': 'Collection Development Division',
        'tier': 'staff', 'role': 'staff',
        'password': 'Staff@123',
        'photo_path': '/media/team/photos/NizamHusain.jpg',
        'linkedin': '', 'profile': '', 'scholar': '', 'order': 10,
    },
    {
        'first': 'Rahul Kumar', 'last': 'Napit',
        'email': 'napitrahul@iitd.ac.in',
        'phone': '',
        'designation': 'Sr. Library Information Assistant',
        'department': 'Collection Development Division',
        'tier': 'staff', 'role': 'staff',
        'password': 'Staff@123',
        'photo_path': '/media/team/photos/rahulnapit.jpeg',
        'linkedin': '', 'profile': '', 'scholar': '', 'order': 11,
    },
    {
        'first': 'Charu', 'last': 'Verma',
        'email': 'charu@library.iitd.ac.in',
        'phone': '+91-11-26596652',
        'designation': 'Sr. Library Information Assistant',
        'department': 'Collection Development Division',
        'tier': 'staff', 'role': 'staff',
        'password': 'Staff@123',
        'photo_path': '/media/team/photos/charu.jpg',
        'linkedin': 'https://www.linkedin.com/in/charu-verma-12296a171',
        'profile': '', 'scholar': '', 'order': 12,
    },
    {
        'first': 'Ratna', 'last': 'Das',
        'email': 'ratnad@library.iitd.ac.in',
        'phone': '+91-11-26597017',
        'designation': 'Sr. Library Information Assistant',
        'department': 'Reader Services Division',
        'tier': 'staff', 'role': 'staff',
        'password': 'Staff@123',
        'photo_path': '/media/team/photos/ratna.jpg',
        'linkedin': 'https://www.linkedin.com/in/ratna-das-260371190',
        'profile': '', 'scholar': '', 'order': 13,
    },
    {
        'first': 'B. Kranthi', 'last': 'Kumar',
        'email': 'bingi92@library.iitd.ac.in',
        'phone': '+91-11-26596654',
        'designation': 'Library Information Assistant',
        'department': 'Text Book & Book Bank',
        'tier': 'staff', 'role': 'staff',
        'password': 'Staff@123',
        'photo_path': '/media/team/photos/BK.jpg',
        'linkedin': 'https://www.linkedin.com/in/kranthikumar16/',
        'profile': '', 'scholar': '', 'order': 14,
    },
    {
        'first': 'Vijay', 'last': 'Kumar',
        'email': 'kvijay@library.iitd.ac.in',
        'phone': '+91-11-26597017',
        'designation': 'Library Information Assistant',
        'department': 'Reader Services Division',
        'tier': 'staff', 'role': 'staff',
        'password': 'Staff@123',
        'photo_path': '/media/team/photos/VK.jpg',
        'linkedin': '', 'profile': '', 'scholar': '', 'order': 15,
    },
    {
        'first': 'Meemansha', 'last': 'Nabiyal',
        'email': 'meemansha@library.iitd.ac.in',
        'phone': '+91-11-26596654',
        'designation': 'Library Information Assistant',
        'department': 'Text Book, Book Bank & Theses',
        'tier': 'staff', 'role': 'staff',
        'password': 'Staff@123',
        'photo_path': '/media/team/photos/meemansha.jpeg',
        'linkedin': 'https://www.linkedin.com/in/meemansha-nabiyal28/',
        'profile': '', 'scholar': '', 'order': 16,
    },
    {
        'first': 'Hariom', 'last': 'Kumar',
        'email': 'a2686@admin.iitd.ac.in',
        'phone': '+91-11-26596665',
        'designation': 'Asst. Admin. Officer',
        'department': 'Store & Purchase Section',
        'tier': 'staff', 'role': 'staff',
        'password': 'Staff@123',
        'photo_path': '/media/team/photos/Hariom_Kumar.jpeg',
        'linkedin': '', 'profile': '', 'scholar': '', 'order': 17,
    },
    {
        'first': 'Govind', 'last': 'Singh',
        'email': 'a27197@library.iitd.ac.in',
        'phone': '+91-11-26596652',
        'designation': 'Admn. Asstt',
        'department': 'Collection Development Division',
        'tier': 'staff', 'role': 'staff',
        'password': 'Staff@123',
        'photo_path': '/media/team/photos/govind.jpg',
        'linkedin': '', 'profile': '', 'scholar': '', 'order': 18,
    },
]


def download_photo(url_path):
    """Download photo from IITD website via proxy, return (filename, ContentFile) or None."""
    full_url = BASE_URL + url_path
    filename = os.path.basename(url_path)
    try:
        resp = requests.get(
            full_url,
            proxies=PROXIES,
            verify=False,
            timeout=15,
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        resp.raise_for_status()
        return filename, ContentFile(resp.content)
    except Exception as e:
        print(f"  ⚠ Failed to download {full_url}: {e}")
        return None


def run():
    # Fetch first active conference dynamically if model exists
    conf = None
    if Conference:
        conf = Conference.objects.first()
        if not conf:
            print("⚠ No Conference record exists yet — creating staff without check-ins.")
    else:
        print("⚠ Conference model not available — skipping pre-check-in.")

    created_count = 0
    updated_count = 0

    for d in STAFF_DATA:
        email = d['email'].lower().strip()

        # ── Create or get User ──
        user, is_new = User.objects.get_or_create(
            email=email,
            defaults={
                'first_name': d['first'],
                'last_name': d['last'],
                'role': d['role'],
            }
        )
        if is_new:
            user.set_password(d['password'])
            user.save()
            created_count += 1
            print(f"  ✅ Created user: {email} ({d['role']})")
        else:
            if user.role != d['role']:
                user.role = d['role']
                user.save(update_fields=['role'])
            updated_count += 1
            print(f"  ⏭ User exists: {email}")

        # ── Create or update StaffProfile ──
        profile, _ = StaffProfile.objects.get_or_create(
            user=user,
            defaults={
                'tier': d['tier'],
                'designation': d['designation'],
                'department': d.get('department', ''),
                'phone': d.get('phone', ''),
                'linkedin_url': d.get('linkedin', ''),
                'profile_url': d.get('profile', ''),
                'scholar_url': d.get('scholar', ''),
                'order': d['order'],
                'is_public': True,
            }
        )

        # ── Download & save photo ──
        if not profile.photo and d.get('photo_path'):
            result = download_photo(d['photo_path'])
            if result:
                fname, content = result
                profile.photo.save(fname, content, save=True)
                print(f"    📷 Photo saved: {fname}")

        # ── Pre-check-in ──
        if conf:
            CheckIn.objects.get_or_create(
                user=user,
                conference=conf,
                defaults={'checkin_type': 'registration'}
            )

    print(f"\n🎉 Done! Created: {created_count}, Updated: {updated_count}")
    print(f"   Total staff in DB: {StaffProfile.objects.count()}")


if __name__ == '__main__':
    run()
