import os, sys, django, requests, urllib3
from django.core.files.base import ContentFile

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'confhub.settings')
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

from django.conf import settings
from apps.accounts.models import StaffProfile

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Clean proxy environment variables to prevent tunnel loop issues
for key in ['http_proxy', 'https_proxy', 'HTTP_PROXY', 'HTTPS_PROXY', 'all_proxy', 'ALL_PROXY']:
    if key in os.environ:
        del os.environ[key]

PHOTO_MAP = {
    'hodlibrary@admin.iitd.ac.in': '/media/team/photos/pic.jpg',
    'neerajkc@library.iitd.ac.in': '/media/team/photos/neeraj.jpg',
    'shankar.chavan@library.iitd.ac.in': '/media/team/photos/sbc.jpg',
    'vkverma@library.iitd.ac.in': '/media/team/photos/vijay_verma.jpg',
    'vanita@library.iitd.ac.in': '/media/team/photos/8802925841.JPG',
    'gargmohit@library.iitd.ac.in': '/media/team/photos/mohit.png',
    'manutr@library.iitd.ac.in': '/media/team/photos/IMG_0735.JPG',
    'satbir@library.iitd.ac.in': '/media/team/photos/satbir.png',
    'gunjan0605@library.iitd.ac.in': '/media/team/photos/gunjanmi.jpg',
    'nizam@library.iitd.ac.in': '/media/team/photos/NizamHusain.jpg',
    'napitrahul@iitd.ac.in': '/media/team/photos/rahulnapit.jpeg',
    'charu@library.iitd.ac.in': '/media/team/photos/charu.jpg',
    'ratnad@library.iitd.ac.in': '/media/team/photos/ratna.jpg',
    'bingi92@library.iitd.ac.in': '/media/team/photos/BK.jpg',
    'kvijay@library.iitd.ac.in': '/media/team/photos/VK.jpg',
    'meemansha@library.iitd.ac.in': '/media/team/photos/meemansha.jpeg',
    'a2686@admin.iitd.ac.in': '/media/team/photos/Hariom_Kumar.jpeg',
    'a27197@library.iitd.ac.in': '/media/team/photos/govind.jpg',
}

BASE_URL = 'https://library.iitd.ac.in'
session = requests.Session()
session.trust_env = False

print("🚀 Starting download of all 18 photos from https://library.iitd.ac.in ...\n")
success_count = 0

for profile in StaffProfile.objects.select_related('user').all():
    email = profile.user.email.lower().strip()
    path = PHOTO_MAP.get(email)
    if not path:
        continue
        
    url = BASE_URL + path
    filename = os.path.basename(path)
    print(f"📥 Fetching: {url} for {profile.user.get_full_name()} ({email})")
    
    try:
        resp = session.get(url, verify=False, timeout=12, headers={'User-Agent': 'Mozilla/5.0'})
        if resp.status_code == 200 and len(resp.content) > 500:
            profile.photo.save(filename, ContentFile(resp.content), save=True)
            success_count += 1
            print(f"   ✅ Saved {filename} ({len(resp.content) // 1024} KB)")
        else:
            print(f"   ⚠ Status code {resp.status_code}")
    except Exception as e:
        print(f"   ❌ Error: {e}")

print(f"\n🎉 Finished! Downloaded and saved {success_count}/18 photos.")
