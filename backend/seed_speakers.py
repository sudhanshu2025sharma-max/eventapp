import os
import sys
import django
import urllib.request
import ssl

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'confhub.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from apps.speakers.models import Speaker

# Clear existing speakers
Speaker.objects.all().delete()
print("🗑️  Cleared existing speakers")

# Create media/speakers directory
media_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'media', 'speakers')
os.makedirs(media_dir, exist_ok=True)

speakers_data = [
    {
        'title': 'ms',
        'first_name': 'Jennifer',
        'last_name': 'Gibson',
        'designation': 'Executive Director',
        'institute': 'Dryad',
        'country': 'USA',
        'bio': 'Workshop Lead. Executive Director at Dryad, a non-profit open data publishing platform supporting curation, preservation, sharing, and reuse of research data across disciplines.',
        'linkedin_url': 'https://www.linkedin.com/in/jmclenna',
        'website_url': 'https://datadryad.org',
        'image_url': 'https://etd2026.iitd.ac.in/wp-content/uploads/2026/08/Jen-headshot.png',
        'image_name': 'jennifer_gibson.png',
        'is_keynote': True,
        'display_order': 1,
    },
    {
        'title': 'prof',
        'first_name': 'A.R.D.',
        'last_name': 'Prasad',
        'designation': 'Former Professor',
        'institute': 'DRTC (ISI), Bangalore',
        'country': 'India',
        'bio': 'Former Professor at Documentation Research and Training Centre (DRTC), Indian Statistical Institute, Bangalore.',
        'linkedin_url': 'https://www.linkedin.com/in/prasad-ard-97235235/',
        'image_url': 'https://etd2026.iitd.ac.in/wp-content/uploads/2026/03/download-14-150x150.png',
        'image_name': 'ard_prasad.png',
        'is_keynote': False,
        'display_order': 2,
    },
    {
        'title': 'prof',
        'first_name': 'Ajay Pratap',
        'last_name': 'Singh',
        'designation': 'Professor',
        'institute': 'Banaras Hindu University',
        'country': 'India',
        'bio': 'Professor at Banaras Hindu University, Uttar Pradesh, India.',
        'website_url': 'https://en.wikipedia.org/wiki/Ajay_Pratap_Singh_(librarian)',
        'image_url': 'https://etd2026.iitd.ac.in/wp-content/uploads/2026/02/aps-191x300.jpg',
        'image_name': 'ajay_pratap_singh.jpg',
        'is_keynote': False,
        'display_order': 3,
    },
    {
        'title': 'prof',
        'first_name': 'Ana',
        'last_name': 'Pavani',
        'designation': 'Professor',
        'institute': 'Pontifical Catholic University, Rio de Janeiro',
        'country': 'Brazil',
        'bio': 'Professor at Pontifical Catholic University, Rio de Janeiro. Member of NDLTD Board of Directors.',
        'website_url': 'https://ndltd.org/directory/board-of-directors/ana-pavani/',
        'image_url': 'https://etd2026.iitd.ac.in/wp-content/uploads/2026/03/Ana-Pavani-150x150.jpg',
        'image_name': 'ana_pavani.jpg',
        'is_keynote': False,
        'display_order': 4,
    },
    {
        'title': 'prof',
        'first_name': 'Devika',
        'last_name': 'Madalli',
        'designation': 'Director',
        'institute': 'INFLIBNET Centre, Gandhinagar',
        'country': 'India',
        'bio': 'Director at INFLIBNET Centre, Gandhinagar, India.',
        'website_url': 'https://www.inflibnet.ac.in/about/director.php',
        'image_url': 'https://etd2026.iitd.ac.in/wp-content/uploads/2026/04/Director.png',
        'image_name': 'devika_madalli.png',
        'is_keynote': False,
        'display_order': 5,
    },
    {
        'title': 'prof',
        'first_name': 'Edward A.',
        'last_name': 'Fox',
        'designation': 'Professor of Computer Science',
        'institute': 'Virginia Tech',
        'country': 'USA',
        'bio': 'Professor of Computer Science at Virginia Tech, USA. Member of NDLTD Board of Directors.',
        'website_url': 'https://ndltd.org/directory/board-of-directors/edward-a-fox/',
        'image_url': 'https://etd2026.iitd.ac.in/wp-content/uploads/2026/01/FoxPhoto-300x300-1-150x150.jpg',
        'image_name': 'edward_fox.jpg',
        'is_keynote': True,
        'display_order': 6,
    },
    {
        'title': 'ms',
        'first_name': 'Heather',
        'last_name': 'Greer Klein',
        'designation': 'Community Manager',
        'institute': 'Samvera Foundation',
        'country': 'USA',
        'bio': 'Community Manager at Samvera Foundation, USA.',
        'website_url': 'https://samvera.org/the-community/community-leadership',
        'image_url': 'https://etd2026.iitd.ac.in/wp-content/uploads/2026/06/heather.jpg',
        'image_name': 'heather_greer.jpg',
        'is_keynote': False,
        'display_order': 7,
    },
    {
        'title': 'dr',
        'first_name': 'Jagdish',
        'last_name': 'Arora',
        'designation': 'Ex Director',
        'institute': 'INFLIBNET, Gandhinagar',
        'country': 'India',
        'bio': 'Former Director of INFLIBNET, Gandhinagar, India.',
        'linkedin_url': 'https://www.linkedin.com/in/jagdish-arora-67422a34/',
        'image_url': 'https://etd2026.iitd.ac.in/wp-content/uploads/2026/03/1547612361616-150x150.jpg',
        'image_name': 'jagdish_arora.jpg',
        'is_keynote': False,
        'display_order': 8,
    },
    {
        'title': 'prof',
        'first_name': 'M.',
        'last_name': 'Madhan',
        'designation': 'Director, Global Library & Professor',
        'institute': 'O.P. Jindal University, Haryana',
        'country': 'India',
        'bio': 'Director, Global Library and Professor at O.P. Jindal University, Haryana, India.',
        'website_url': 'https://dstcpriisc.org/madhan-muthu/',
        'image_url': 'https://etd2026.iitd.ac.in/wp-content/uploads/2026/02/Muthu-Madhan-150x150.png',
        'image_name': 'm_madhan.png',
        'is_keynote': False,
        'display_order': 9,
    },
    {
        'title': 'mr',
        'first_name': 'Manoj Kumar',
        'last_name': 'K',
        'designation': 'Scientist F-CS',
        'institute': 'INFLIBNET Centre, Gandhinagar',
        'country': 'India',
        'bio': 'Scientist F-CS at INFLIBNET Centre, Gandhinagar, India.',
        'linkedin_url': 'https://www.linkedin.com/in/manoj-kumar-k-scientist-f-cs-985aa07',
        'image_url': 'https://etd2026.iitd.ac.in/wp-content/uploads/2026/04/41693_manoj-pp.jpg',
        'image_name': 'manoj_kumar.jpg',
        'is_keynote': False,
        'display_order': 10,
    },
    {
        'title': 'prof',
        'first_name': 'Parthasarathi',
        'last_name': 'Mukhopadhyay',
        'designation': 'Professor',
        'institute': 'University of Kalyani',
        'country': 'India',
        'bio': 'Professor at Department of Library and Information Science, University of Kalyani, India.',
        'website_url': 'https://klyuniv.ac.in/professors/parthasarathi-mukhopadhyay',
        'image_url': 'https://etd2026.iitd.ac.in/wp-content/uploads/2026/04/1649672978-psm-ltc-2019.png',
        'image_name': 'parthasarathi.png',
        'is_keynote': False,
        'display_order': 11,
    },
    {
        'title': 'prof',
        'first_name': 'Ponnurangam',
        'last_name': 'Kumaraguru',
        'designation': 'Professor',
        'institute': 'IIIT Hyderabad',
        'country': 'India',
        'bio': 'Professor at International Institute of Information Technology Hyderabad.',
        'website_url': 'https://www.iiit.ac.in/faculty/ponnurangam-kumaraguru/',
        'image_url': 'https://etd2026.iitd.ac.in/wp-content/uploads/2026/08/1766720170898.png',
        'image_name': 'ponnurangam.png',
        'is_keynote': True,
        'display_order': 12,
    },
    {
        'title': 'prof',
        'first_name': 'Ramesh C',
        'last_name': 'Gaur',
        'designation': 'Professor & Dean',
        'institute': 'Faculty of Arts & South Asian University, Delhi',
        'country': 'India',
        'bio': 'Professor and Dean at Faculty of Arts, South Asian University, Delhi.',
        'website_url': 'https://ignca.gov.in/PDF_data/profile_of_dr_ramesh_c_gaur.pdf',
        'image_url': 'https://etd2026.iitd.ac.in/wp-content/uploads/2026/02/profrcg-247x300.jpg',
        'image_name': 'ramesh_gaur.jpg',
        'is_keynote': False,
        'display_order': 13,
    },
    {
        'title': 'dr',
        'first_name': 'Saiful',
        'last_name': 'Amin',
        'designation': 'Director',
        'institute': 'Semantic Consulting Services Pvt. Ltd., Bengaluru',
        'country': 'India',
        'bio': 'Director at Semantic Consulting Services Pvt. Ltd., Bengaluru, India.',
        'linkedin_url': 'https://in.linkedin.com/in/aminsaiful',
        'image_url': 'https://etd2026.iitd.ac.in/wp-content/uploads/2026/02/aminsaiful.jpg',
        'image_name': 'saiful_amin.jpg',
        'is_keynote': False,
        'display_order': 14,
    },
    {
        'title': 'dr',
        'first_name': 'Sangeeta',
        'last_name': 'Kaul',
        'designation': 'Director',
        'institute': 'DELNET, New Delhi',
        'country': 'India',
        'bio': 'Director at DELNET, New Delhi, India.',
        'linkedin_url': 'https://www.linkedin.com/in/sangeeta-kaul-a8697678/',
        'image_url': 'https://etd2026.iitd.ac.in/wp-content/uploads/2026/03/download-1-150x150.jpg',
        'image_name': 'sangeeta_kaul.jpg',
        'is_keynote': False,
        'display_order': 15,
    },
    {
        'title': 'prof',
        'first_name': 'Uma',
        'last_name': 'Kanjilal',
        'designation': 'Vice-Chancellor',
        'institute': 'IGNOU, New Delhi',
        'country': 'India',
        'bio': 'Vice-Chancellor at Indira Gandhi National Open University (IGNOU), New Delhi, India.',
        'website_url': 'https://www.ignou.ac.in/pages/10#Vice-Chancellor',
        'image_url': 'https://etd2026.iitd.ac.in/wp-content/uploads/2026/03/download-2-1-150x150.png',
        'image_name': 'uma_kanjilal.png',
        'is_keynote': True,
        'display_order': 16,
    },
    {
        'title': 'dr',
        'first_name': 'Usha Mujoo',
        'last_name': 'Munshi',
        'designation': 'Chief Librarian',
        'institute': 'India International Centre, New Delhi',
        'country': 'India',
        'bio': 'Chief Librarian at India International Centre, New Delhi.',
        'website_url': 'https://www.teriin.org/events/icdl/img/speakers/bionote/Usha-M-Munshi.pdf',
        'image_url': 'https://etd2026.iitd.ac.in/wp-content/uploads/2026/02/33502393_10157580335902516_275666115047194624_n-255x300.jpg',
        'image_name': 'usha_munshi.jpg',
        'is_keynote': False,
        'display_order': 17,
    },
    {
        'title': 'dr',
        'first_name': 'Washington',
        'last_name': 'Segundo',
        'designation': 'Interim General Coordinator of Scientific and Technical Information',
        'institute': 'Brazilian Institute of Information in Science and Technology (Ibict / MCTI)',
        'country': 'Brazil',
        'bio': 'Interim General Coordinator of Scientific and Technical Information at Brazilian Institute of Information in Science and Technology (Ibict / MCTI).',
        'linkedin_url': 'https://www.linkedin.com/in/washington-segundo-5517126b/',
        'image_url': 'https://etd2026.iitd.ac.in/wp-content/uploads/2026/08/IMG_1595.jpg',
        'image_name': 'washington_segundo.jpg',
        'is_keynote': False,
        'display_order': 18,
    },
    {
        'title': 'dr',
        'first_name': 'William A.',
        'last_name': 'Ingram',
        'designation': 'Associate Dean & Director',
        'institute': 'IT for University Libraries, Virginia Tech',
        'country': 'USA',
        'bio': 'Associate Dean and Director, IT for University Libraries at Virginia Tech. Member of NDLTD Board of Directors.',
        'website_url': 'https://ndltd.org/directory/board-of-directors/william-a-ingram/',
        'image_url': 'https://etd2026.iitd.ac.in/wp-content/uploads/2026/03/William-A-Ingram-300x300-1-1-150x150.jpg',
        'image_name': 'william_ingram.jpg',
        'is_keynote': False,
        'display_order': 19,
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

for s in speakers_data:
    # Download image
    image_path = os.path.join(media_dir, s['image_name'])
    try:
        if not os.path.exists(image_path):
            print(f"📥 Downloading {s['first_name']} {s['last_name']}...")
            urllib.request.urlretrieve(s['image_url'], image_path)
            print(f"   ✅ Saved: {s['image_name']}")
        else:
            print(f"   ⏭️  Exists: {s['image_name']}")
    except Exception as e:
        print(f"   ❌ Failed: {s['first_name']} {s['last_name']}: {e}")

    # Create speaker record
    try:
        Speaker.objects.create(
            title=s['title'],
            first_name=s['first_name'],
            last_name=s['last_name'],
            designation=s['designation'],
            institute=s['institute'],
            country=s['country'],
            bio=s['bio'],
            photo=f"speakers/{s['image_name']}",
            website_url=s.get('website_url', ''),
            linkedin_url=s.get('linkedin_url', ''),
            is_keynote=s['is_keynote'],
            is_active=True,
            display_order=s['display_order'],
        )
        print(f"✅ Created: {s['first_name']} {s['last_name']}")
    except Exception as e:
        print(f"❌ DB Error: {s['first_name']} {s['last_name']}: {e}")

print(f"\n🎉 Total speakers: {Speaker.objects.count()}")

# List downloaded images
print("\n📁 Images in media/speakers/:")
for f in sorted(os.listdir(media_dir)):
    size = os.path.getsize(os.path.join(media_dir, f))
    print(f"   {f} ({size:,} bytes)")
