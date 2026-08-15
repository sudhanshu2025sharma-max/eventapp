import os
import sys
import django
import urllib.request
import ssl

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'confhub.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from apps.sponsors.models import Sponsor

# Clear existing sponsors
Sponsor.objects.all().delete()
print("🗑️  Cleared existing sponsors")

# Create media/sponsors directory
media_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'media', 'sponsors')
os.makedirs(media_dir, exist_ok=True)

sponsors_data = [
    {
        'name': 'ANRF',
        'tier': 'national_funding',
        'website_url': 'https://anrfonline.in/ANRF/HomePage',
        'image_url': 'https://etd2026.iitd.ac.in/wp-content/uploads/2026/07/anrf.jpg',
        'image_name': 'anrf.jpg',
        'description': 'Anusandhan National Research Foundation - National Funding Agency',
        'display_order': 1,
    },
    {
        'name': 'Clarivate',
        'tier': 'platinum',
        'website_url': 'https://clarivate.com/',
        'image_url': 'https://etd2026.iitd.ac.in/wp-content/uploads/2026/06/Clarivate-Logo-RGB_Horizontal-composition_Color-Edited.png',
        'image_name': 'clarivate.png',
        'description': 'Clarivate - Global leader in providing trusted information and insights',
        'display_order': 2,
    },
    {
        'name': 'Vir Softech',
        'tier': 'silver',
        'website_url': 'https://www.virsoftech.com/',
        'image_url': 'https://etd2026.iitd.ac.in/wp-content/uploads/2026/07/virsoftech1.png',
        'image_name': 'virsoftech.png',
        'description': 'Vir Softech - Technology Solutions Provider',
        'display_order': 3,
    },
    {
        'name': 'DrillBit',
        'tier': 'silver',
        'website_url': 'https://drillbitglobal.com/',
        'image_url': 'https://etd2026.iitd.ac.in/wp-content/uploads/2026/07/1b01f228-776c-4e35-befa-f45fd874763a.png',
        'image_name': 'drillbit.png',
        'description': 'DrillBit - Plagiarism Detection Software',
        'display_order': 4,
    },
    {
        'name': 'IEEE',
        'tier': 'bronze',
        'website_url': 'https://www.ieee.org',
        'image_url': 'https://etd2026.iitd.ac.in/wp-content/uploads/2026/06/Print-Edited.png',
        'image_name': 'ieee.png',
        'description': 'IEEE - Institute of Electrical and Electronics Engineers',
        'display_order': 5,
    },
    {
        'name': 'iGroup India',
        'tier': 'bronze',
        'website_url': 'https://www.igroupnet.com',
        'image_url': 'https://etd2026.iitd.ac.in/wp-content/uploads/2026/06/iGroup-India-Logo-Edited.png',
        'image_name': 'igroup.png',
        'description': 'iGroup India - Information Solutions Provider',
        'display_order': 6,
    },
    {
        'name': 'Packt',
        'tier': 'bronze',
        'website_url': 'https://www.packtpub.com/en-in',
        'image_url': 'https://etd2026.iitd.ac.in/wp-content/uploads/2026/06/Packt_Logo-scaled.png',
        'image_name': 'packt.png',
        'description': 'Packt Publishing - Technology Books and Learning',
        'display_order': 7,
    },
    {
        'name': 'BSB Edge',
        'tier': 'bronze',
        'website_url': 'https://www.bsbedge.com/',
        'image_url': 'https://etd2026.iitd.ac.in/wp-content/uploads/2026/06/logo.png',
        'image_name': 'bsb.png',
        'description': 'BSB Edge - Business Solutions',
        'display_order': 8,
    },
    {
        'name': 'World Scientific',
        'tier': 'bronze',
        'website_url': 'https://www.worldscientific.com/',
        'image_url': 'https://etd2026.iitd.ac.in/wp-content/uploads/2026/06/WSPC-Logo-scaled.png',
        'image_name': 'worldscientific.png',
        'description': 'World Scientific Publishing',
        'display_order': 9,
    },
    {
        'name': 'Cambridge University Press',
        'tier': 'bronze',
        'website_url': 'https://www.cambridge.org/',
        'image_url': 'https://etd2026.iitd.ac.in/wp-content/uploads/2026/07/shcup_pos_rgb.png',
        'image_name': 'cambridge.png',
        'description': 'Cambridge University Press & Assessment',
        'display_order': 10,
    },
    {
        'name': 'Springer Nature',
        'tier': 'bronze',
        'website_url': 'https://www.springernature.com/',
        'image_url': 'https://etd2026.iitd.ac.in/wp-content/uploads/2026/07/SN_sm.png',
        'image_name': 'springernature.png',
        'description': 'Springer Nature - Academic Publishing',
        'display_order': 11,
    },
    {
        'name': 'KGL Accucoms',
        'tier': 'bronze',
        'website_url': 'https://accucoms.com/about-accucoms-2/',
        'image_url': 'https://etd2026.iitd.ac.in/wp-content/uploads/2026/07/KGL_Accucoms_logo_horiz_RGB_600px.jpg',
        'image_name': 'accucoms.jpg',
        'description': 'KGL Accucoms - Scholarly Communication Solutions',
        'display_order': 12,
    },
    {
        'name': 'TLS Group',
        'tier': 'bronze',
        'website_url': 'http://www.tlsgroup.co.in/',
        'image_url': 'https://etd2026.iitd.ac.in/wp-content/uploads/2026/07/tls-logo.png',
        'image_name': 'tls.png',
        'description': 'TLS Group - Technology and Library Solutions',
        'display_order': 13,
    },
]

# SSL context that bypasses verification (needed for IITD proxy)
ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

# Set up proxy + SSL bypass
proxy_handler = urllib.request.ProxyHandler({
    'http': 'http://proxy21.iitd.ac.in:3128',
    'https': 'http://proxy21.iitd.ac.in:3128',
})
https_handler = urllib.request.HTTPSHandler(context=ssl_ctx)
opener = urllib.request.build_opener(proxy_handler, https_handler)
urllib.request.install_opener(opener)

for s in sponsors_data:
    # Download image
    image_path = os.path.join(media_dir, s['image_name'])
    try:
        if not os.path.exists(image_path):
            print(f"📥 Downloading {s['name']} logo...")
            urllib.request.urlretrieve(s['image_url'], image_path)
            print(f"   ✅ Saved: {s['image_name']}")
        else:
            print(f"   ⏭️  Exists: {s['image_name']}")
    except Exception as e:
        print(f"   ❌ Failed: {s['name']}: {e}")

    # Create sponsor record
    try:
        Sponsor.objects.create(
            name=s['name'],
            tier=s['tier'],
            website_url=s['website_url'],
            logo=f"sponsors/{s['image_name']}",
            description=s['description'],
            display_order=s['display_order'],
            is_active=True,
        )
        print(f"✅ Created: {s['name']} ({s['tier']})")
    except Exception as e:
        print(f"❌ DB Error for {s['name']}: {e}")

print(f"\n🎉 Total sponsors: {Sponsor.objects.count()}")

# List downloaded images
print("\n📁 Images in media/sponsors/:")
for f in sorted(os.listdir(media_dir)):
    size = os.path.getsize(os.path.join(media_dir, f))
    print(f"   {f} ({size:,} bytes)")
