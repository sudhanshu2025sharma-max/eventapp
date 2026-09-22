import os, sys, django, requests, urllib3, subprocess
from django.core.files.base import ContentFile

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'confhub.settings')
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

from apps.accounts.models import StaffProfile

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Clean environment proxy variables so requests doesn't try routing internal domains via proxy
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

BASE_URL = 'https://etd2026.iitd.ac.in'

session = requests.Session()
session.trust_env = False  # Completely disable proxy lookup

print("🔄 Starting Photo Download Loop...")
for profile in StaffProfile.objects.all():
    email = profile.user.email.lower().strip()
    path = PHOTO_MAP.get(email)
    if not path:
        continue
    
    if profile.photo:
        print(f"  ⏭ Photo already exists for {email}")
        continue
        
    url = BASE_URL + path
    filename = os.path.basename(path)
    print(f"  📥 Fetching {url} for {email}...")
    
    data = None
    try:
        resp = session.get(url, verify=False, timeout=8, headers={'User-Agent': 'Mozilla/5.0'})
        if resp.status_code == 200:
            data = resp.content
            print(f"    ✅ Downloaded via direct session!")
    except Exception as e:
        print(f"    ⚠ Direct requests failed ({e}), trying curl fallback...")
        try:
            res = subprocess.run(['curl', '-k', '--noproxy', '*', '-s', url], stdout=subprocess.PIPE, check=True)
            if len(res.stdout) > 500:
                data = res.stdout
                print(f"    ✅ Downloaded via curl --noproxy!")
        except Exception as ce:
            print(f"    ❌ curl failed too: {ce}")

    if data:
        profile.photo.save(filename, ContentFile(data), save=True)
        print(f"    💾 Saved photo to profile: {filename}")
    else:
        print(f"    ❌ Failed to save photo for {email}")

print("\n🎉 Photo fetching run complete.")
