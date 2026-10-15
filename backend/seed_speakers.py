"""
Seed ETD 2026 Speakers + SpeakerTalks from official speaker wall HTML.
Downloads photos via IITD proxy, links talks to schedule sessions.

Usage:
  cd /home/baadalvm/eventapp/backend
  python3 seed_speakers.py
"""
import os, sys, django, urllib.request, ssl, shutil, re
from datetime import date, time

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'confhub.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from apps.speakers.models import Speaker, SpeakerTalk
from apps.schedule.models import ScheduleSession

# ── SSL + IITD Proxy (same pattern as old script) ──
ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

proxy_handler = urllib.request.ProxyHandler({
    'http': 'http://proxy21.iitd.ac.in:3128',
    'https': 'http://proxy21.iitd.ac.in:3128',
})
https_handler = urllib.request.HTTPSHandler(context=ssl_ctx)
opener = urllib.request.build_opener(proxy_handler, https_handler)
urllib.request.install_opener(opener)

# ── Paths ──
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MEDIA_DIR = os.path.join(BASE_DIR, 'media', 'speakers', 'photos')
os.makedirs(MEDIA_DIR, exist_ok=True)

# ═══════════════════════════════════════════════════════════════
#  48 SPEAKERS — exact data from speaker wall HTML
#  talk_session_match = substring to find ScheduleSession for SpeakerTalk
#  talk_title = the talk/presentation title
#  talk_track = role category
# ═══════════════════════════════════════════════════════════════
SPEAKERS = [
    # ── WORKSHOP LEAD ──
    dict(title='ms', first='Jennifer', last='Gibson',
         designation='Executive Director', institute='Dryad', country='USA',
         linkedin='https://www.linkedin.com/in/jmclenna',
         website='https://datadryad.org',
         img_url='https://etd2026.iitd.ac.in/wp-content/uploads/2026/08/Jen-headshot.png',
         img_name='jennifer_gibson.png',
         is_keynote=False,
         talks=[('Workshop on Dryad: Publish and Preserve Your Data', 'Workshop Lead')]),

    # ── KEYNOTE SPEAKERS (4) ──
    dict(title='prof', first='Ponnurangam', last='Kumaraguru',
         designation='Professor', institute='International Institute of Information Technology Hyderabad', country='India',
         website='https://www.iiit.ac.in/faculty/ponnurangam-kumaraguru/',
         img_url='https://etd2026.iitd.ac.in/wp-content/uploads/2026/08/1766720170898.png',
         img_name='ponnurangam_kumaraguru.png',
         is_keynote=True,
         talks=[('Saral AI: Democratising Scholarly Work by Transforming into Accessible, Multilingual Content', 'Keynote Speaker')]),

    dict(title='mr', first='Kanwaljeet', last='Singh',
         designation='AI & Blockchain Consultant and Trainer', institute='Gurugram, Haryana', country='India',
         linkedin='https://www.linkedin.com/in/kanwaljeet-singh-arora-b6955a3/',
         img_url='https://etd2026.iitd.ac.in/wp-content/uploads/2026/10/kanwaljeetSingh.jpg',
         img_name='kanwaljeet_singh.jpg',
         is_keynote=True,
         talks=[('The Next Evolution of ETDs: Reimagining Academic Knowledge in the Age of Generative AI', 'Keynote Speaker')]),

    dict(title='ms', first='Shameem Nilofar', last='Maideen',
         designation='University Librarian', institute='Singapore Management University', country='Singapore',
         linkedin='https://sg.linkedin.com/in/shameem-nilofar-873a7422',
         img_url='https://etd2026.iitd.ac.in/wp-content/uploads/2026/10/ShameemNilofar.jpg',
         img_name='shameem_maideen.jpg',
         is_keynote=True,
         talks=[('Show Your Working: ETDs and the Evidence of Thinking', 'Keynote Speaker')]),

    dict(title='mr', first='Julien', last='Masanes',
         designation='Co-Founder', institute='Internet Archive Europe', country='France',
         linkedin='https://fr.linkedin.com/in/julien-masanes',
         img_url='https://etd2026.iitd.ac.in/wp-content/uploads/2026/10/julienMasanes.jpg',
         img_name='julien_masanes.jpg',
         is_keynote=True,
         talks=[
             ('How Can the Internet Archive Help? Preserving the Open Thesis Record', 'Keynote Speaker'),
             ('Address by Guest of Honour', 'Guest of Honour'),
         ]),

    # ── WELCOME ADDRESS (1) ──
    dict(title='prof', first='Ramesh C', last='Gaur',
         designation='Professor & Dean', institute='Faculty of Arts & South Asian University, Delhi', country='India',
         website='https://ignca.gov.in/PDF_data/profile_of_dr_ramesh_c_gaur.pdf',
         img_url='https://etd2026.iitd.ac.in/wp-content/uploads/2026/02/profrcg-247x300.jpg',
         img_name='ramesh_gaur.jpg',
         is_keynote=False,
         talks=[('Welcome Address', 'Welcome Address')]),

    # ── GUEST OF HONOUR (2 more, Julien already above) ──
    dict(title='prof', first='Devika', last='Madalli',
         designation='Director', institute='INFLIBNET Centre, Gandhinagar', country='India',
         website='https://www.inflibnet.ac.in/about/director.php',
         img_url='https://etd2026.iitd.ac.in/wp-content/uploads/2026/04/Director.png',
         img_name='devika_madalli.png',
         is_keynote=False,
         talks=[('Address by the Guest of Honour', 'Guest of Honour')]),

    dict(title='prof', first='Uma', last='Kanjilal',
         designation='Vice-Chancellor', institute='IGNOU, New Delhi', country='India',
         website='https://www.ignou.ac.in/pages/10#Vice-Chancellor',
         img_url='https://etd2026.iitd.ac.in/wp-content/uploads/2026/03/download-2-1-150x150.png',
         img_name='uma_kanjilal.png',
         is_keynote=False,
         talks=[('Address by Guest of Honour', 'Guest of Honour')]),

    # ── NDLTD (1) ──
    dict(title='prof', first='Edward A.', last='Fox',
         designation='Professor of Computer Science', institute='Virginia Tech', country='USA',
         website='https://ndltd.org/directory/board-of-directors/edward-a-fox/',
         img_url='https://etd2026.iitd.ac.in/wp-content/uploads/2026/01/FoxPhoto-300x300-1-150x150.jpg',
         img_name='edward_fox.jpg',
         is_keynote=False,
         talks=[('Address by Executive Director, NDLTD, USA', 'NDLTD')]),

    # ── IFLA PRESIDENT (1) ──
    dict(title='dr', first='Leslie', last='Weir',
         designation='IFLA President 2025-2027 & Librarian and Archivist of Canada',
         institute='Office of the Librarian and Archivist of Canada', country='Canada',
         website='https://www.canada.ca/en/library-archives/corporate/about-us/mandate-organizational-structure/librarian-archivist-canada.html',
         img_url='https://etd2026.iitd.ac.in/wp-content/uploads/2026/08/leslie.weir-2025-original-768x617-1.jpg',
         img_name='leslie_weir.jpg',
         is_keynote=False,
         talks=[('Address by IFLA President', 'IFLA President')]),

    # ── PRESIDENTIAL ADDRESS (2) ──
    dict(title='prof', first='Arvind K', last='Nema',
         designation='Deputy Director (Operations) / Officiating Director', institute='IIT Delhi', country='India',
         linkedin='https://in.linkedin.com/in/arvind-nema-3a467350',
         img_url='https://etd2026.iitd.ac.in/wp-content/uploads/2026/10/ArvindkNeema.jpg',
         img_name='arvind_nema.jpg',
         is_keynote=False,
         talks=[('Presidential Address', 'Presidential Address')]),

    dict(title='prof', first='Ashwini', last='Agrawal',
         designation='Dean, R&D', institute='IIT Delhi', country='India',
         website='https://textile.iitd.ac.in/faculty-profile/7',
         img_url='https://etd2026.iitd.ac.in/wp-content/uploads/2026/10/ashwinikAgarwal.jpg',
         img_name='ashwini_agrawal.jpg',
         is_keynote=False,
         talks=[('Presidential Address', 'Presidential Address')]),

    # ── VOTE OF THANKS (1) ──
    dict(title='prof', first='B. J.', last='Alappat',
         designation='ACL Chairperson | Professor',
         institute='Department of Civil Engineering, IIT Delhi', country='India',
         img_url='https://etd2026.iitd.ac.in/wp-content/uploads/2026/10/ACLbjalappat.jpg',
         img_name='bj_alappat.jpg',
         is_keynote=False,
         talks=[('Vote of Thanks', 'Vote of Thanks')]),

    # ── CHIEF GUEST (1) — marked is_keynote=True as VIP/featured ──
    dict(title='prof', first='Dhananjay', last='Singh',
         designation='Member Secretary',
         institute='Indian Council of Social Science Research (ICSSR)', country='India',
         img_url='https://etd2026.iitd.ac.in/wp-content/uploads/2026/10/dhananjaySingh.jpg',
         img_name='dhananjay_singh.jpg',
         is_keynote=True,
         talks=[('Address by Chief Guest', 'Chief Guest')]),

    # ── INVITED TALK (24) ──
    dict(title='prof', first='A.R.D.', last='Prasad',
         designation='Former Professor', institute='DRTC (ISI), Bangalore', country='India',
         linkedin='https://www.linkedin.com/in/prasad-ard-97235235/',
         img_url='https://etd2026.iitd.ac.in/wp-content/uploads/2026/03/download-14-150x150.png',
         img_name='ard_prasad.png',
         is_keynote=False,
         talks=[('AI-enabled National Research Discovery Platform', 'Invited Talk')]),

    dict(title='prof', first='Ajay Pratap', last='Singh',
         designation='Professor', institute='Banaras Hindu University, UP', country='India',
         website='https://en.wikipedia.org/wiki/Ajay_Pratap_Singh_(librarian)',
         img_url='https://etd2026.iitd.ac.in/wp-content/uploads/2026/02/aps-191x300.jpg',
         img_name='ajay_pratap_singh.jpg',
         is_keynote=False,
         talks=[('Legible to Whom? Machine Readership, Epistemic Justice and the Stewardship of Next-Generation ETDs', 'Invited Talk')]),

    dict(title='dr', first='Akhtar', last='Parvez',
         designation='University Librarian', institute='Jamia Hamdard, New Delhi', country='India',
         linkedin='https://in.linkedin.com/in/akhtarparvez-jh',
         img_url='https://etd2026.iitd.ac.in/wp-content/uploads/2026/10/akhtarParvez.jpg',
         img_name='akhtar_parvez.jpg',
         is_keynote=False,
         talks=[('From Manuscript Digitisation to Knowledge Extraction: Transforming India\'s Manuscript Heritage', 'Invited Talk')]),

    dict(title='mr', first='Arend', last='Kuester',
         designation='Country Manager India', institute='Springer Nature', country='India',
         linkedin='https://in.linkedin.com/in/arendjk',
         img_url='https://etd2026.iitd.ac.in/wp-content/uploads/2026/10/arendKuester.jpg',
         img_name='arend_kuester.jpg',
         is_keynote=False,
         talks=[
             ('Making India\'s Research Count: Visibility, Trust and Impact in the Age of AI', 'Invited Talk'),
             ('Panel Discussion', 'Panel Discussion'),
         ]),

    dict(title='prof', first='Arjun', last='Ghosh',
         designation='Professor', institute='HUSS, IIT Delhi', country='India',
         linkedin='https://in.linkedin.com/in/arjunghoshiitd',
         img_url='https://etd2026.iitd.ac.in/wp-content/uploads/2026/10/arjunGhosh.jpg',
         img_name='arjun_ghosh.jpg',
         is_keynote=False,
         talks=[('Beyond the PDF: Electronic Theses as Structured, Linked, and Responsibly Published Scholarship', 'Invited Talk')]),

    dict(title='dr', first='Dinesh', last='K.S.',
         designation='Librarian & Registrar', institute='IIT Ropar', country='India',
         website='https://www.iitrpr.ac.in/library',
         img_url='https://etd2026.iitd.ac.in/wp-content/uploads/2026/10/DineshKS.png',
         img_name='dinesh_ks.png',
         is_keynote=False,
         talks=[('Building a Digital Scholarly System: Institutional Repository and Digital Library Services at Nalanda Library, IIT Ropar', 'Invited Talk')]),

    dict(title='dr', first='Hafsa', last='Ahmad',
         designation='Scientist D', institute='Office of the Principal Scientific Adviser, Government of India', country='India',
         linkedin='https://in.linkedin.com/in/hafsa-ahmad-81656145',
         img_url='https://etd2026.iitd.ac.in/wp-content/uploads/2026/10/hafsaAhmad.png',
         img_name='hafsa_ahmad.png',
         is_keynote=False,
         talks=[('One Nation One Subscription (ONOS): A Strategic Imperative', 'Invited Talk')]),

    dict(title='prof', first='Jean-Charles', last='Lamirel',
         designation='Associate Professor (Habilitated to Supervise Research)',
         institute='University of Strasbourg', country='France',
         website='https://scholar.google.com/citations?user=qMj5rKgAAAAJ&hl=fr',
         img_url='https://etd2026.iitd.ac.in/wp-content/uploads/2026/10/jeanCharles.jpg',
         img_name='jean_charles_lamirel.jpg',
         is_keynote=False,
         talks=[('From Scan to Oblivion? Agentic AI and the Vicious Circles of Thesis Digitisation', 'Invited Talk')]),

    dict(title='dr', first='Jagdish', last='Arora',
         designation='Ex Director', institute='INFLIBNET, Gandhinagar', country='India',
         linkedin='https://www.linkedin.com/in/jagdish-arora-67422a34/',
         img_url='https://etd2026.iitd.ac.in/wp-content/uploads/2026/03/1547612361616-150x150.jpg',
         img_name='jagdish_arora.jpg',
         is_keynote=False,
         talks=[('From Vision to a Global Knowledge Commons: The Genesis, Evolution, and Impact of Shodhganga', 'Invited Talk')]),

    dict(title='dr', first='Kishor Chandra', last='Satpathy',
         designation='Chief Librarian & In-charge', institute='PCM Memorial Museum & Archive', country='India',
         linkedin='https://in.linkedin.com/in/kishor-chandra-satpathy-7906ab6',
         img_url='https://etd2026.iitd.ac.in/wp-content/uploads/2026/10/kishorChandraSatpathy.png',
         img_name='kishor_satpathy.png',
         is_keynote=False,
         talks=[('Next Generation ETDs: Considerations of Metadata, Interoperability, Institutional Repositories and the Global Ecosystem', 'Invited Talk')]),

    dict(title='dr', first='Kshema', last='Prakash',
         designation='Librarian', institute='English and Foreign Languages University (EFLU)', country='India',
         linkedin='https://in.linkedin.com/in/kshemaprakash',
         img_url='https://etd2026.iitd.ac.in/wp-content/uploads/2026/10/Keshma.png',
         img_name='kshema_prakash.png',
         is_keynote=False,
         talks=[('Beyond Preservation: Bridging the Metadata Expertise Gap for Multilingual ETDs with AI', 'Invited Talk')]),

    dict(title='dr', first='Manju', last='Naika',
         designation='Chief Library Officer', institute='Central Library, IIT Bombay', country='India',
         linkedin='https://in.linkedin.com/in/manju-naika-bb465174',
         img_url='https://etd2026.iitd.ac.in/wp-content/uploads/2026/10/manjuNaika.png',
         img_name='manju_naika.png',
         is_keynote=False,
         talks=[('Transforming ETD Management: Best Practices, Workflows, Metadata Standards, and Digital Preservation', 'Invited Talk')]),

    dict(title='mr', first='Manoj Kumar', last='K',
         designation='Scientist F-CS', institute='INFLIBNET Centre, Gandhinagar', country='India',
         linkedin='https://www.linkedin.com/in/manoj-kumar-k-scientist-f-cs-985aa07',
         img_url='https://etd2026.iitd.ac.in/wp-content/uploads/2026/04/41693_manoj-pp.jpg',
         img_name='manoj_kumar.jpg',
         is_keynote=False,
         talks=[('INFLIBNET @ETD-2026: An Integrated National Scholarly Ecosystem', 'Invited Talk')]),

    dict(title='mr', first='Mohamad', last='Mostafa',
         designation='Community Specialist', institute='DataCite', country='Germany',
         linkedin='https://ae.linkedin.com/in/mohamad-mostafa',
         img_url='https://etd2026.iitd.ac.in/wp-content/uploads/2026/10/mohamadMostafa.jpg',
         img_name='mohamad_mostafa.jpg',
         is_keynote=False,
         talks=[('Building ETD Visibility, Usage, and Impact with Persistent Identifiers and Open Metadata', 'Invited Talk')]),

    dict(title='dr', first='Nihar Kanta', last='Patra',
         designation='Librarian', institute='Indian Institute of Technology Roorkee', country='India',
         linkedin='https://in.linkedin.com/in/patranihar',
         img_url='https://etd2026.iitd.ac.in/wp-content/uploads/2026/10/niharPatra.jpg',
         img_name='nihar_patra.jpg',
         is_keynote=False,
         talks=[('Open Metadata and Open Knowledge: Towards a National Policy', 'Invited Talk')]),

    dict(title='prof', first='Parthasarathi', last='Mukhopadhyay',
         designation='Professor', institute='Department of Library and Information Science, University of Kalyani', country='India',
         website='https://klyuniv.ac.in/professors/parthasarathi-mukhopadhyay',
         img_url='https://etd2026.iitd.ac.in/wp-content/uploads/2026/04/1649672978-psm-ltc-2019.png',
         img_name='parthasarathi_mukhopadhyay.png',
         is_keynote=False,
         talks=[('The Post-Boolean Librarian: Semantic Search for ETDs through Tool RAG and Richer Metadata', 'Invited Talk')]),

    dict(title='dr', first='Ramesh', last='Yernagula',
         designation='Director (L&I)', institute='Ministry of External Affairs, Govt. of India', country='India',
         linkedin='https://in.linkedin.com/in/ramesh-yernagula-49988517',
         img_url='https://etd2026.iitd.ac.in/wp-content/uploads/2026/10/rameshYernagula.jpg',
         img_name='ramesh_yernagula.jpg',
         is_keynote=False,
         talks=[('From Repository to Policy: Developing a Scholarly Gateway for Indian Foreign Policy Theses', 'Invited Talk')]),

    dict(title='dr', first='Saiful', last='Amin',
         designation='Director', institute='Semantic Consulting Services Pvt. Ltd., Bengaluru', country='India',
         linkedin='https://in.linkedin.com/in/aminsaiful',
         img_url='https://etd2026.iitd.ac.in/wp-content/uploads/2026/02/aminsaiful.jpg',
         img_name='saiful_amin.jpg',
         is_keynote=False,
         talks=[('Preservation with Resilience: Strategic Disaster Recovery Planning for Institutional Repositories', 'Invited Talk')]),

    dict(title='dr', first='Sandeep Kumar', last='Pathak',
         designation='Librarian', institute='IISER Bhopal', country='India',
         linkedin='https://www.linkedin.com/in/dr-sandeep-kumar-pathak-83344722/',
         img_url='https://etd2026.iitd.ac.in/wp-content/uploads/2026/10/sandeep_pathak.jpeg',
         img_name='sandeep_pathak.jpeg',
         is_keynote=False,
         talks=[('One Institution, One Journal: Reimagining Indian Academic Publishing', 'Invited Talk')]),

    dict(title='dr', first='Sangeeta', last='Kaul',
         designation='Director', institute='DELNET, New Delhi', country='India',
         linkedin='https://www.linkedin.com/in/sangeeta-kaul-a8697678/',
         img_url='https://etd2026.iitd.ac.in/wp-content/uploads/2026/03/download-1-150x150.jpg',
         img_name='sangeeta_kaul.jpg',
         is_keynote=False,
         talks=[('AI-Generated Hallucinated Citations: A Threat to the Integrity of Scholarly Research and ETDs', 'Invited Talk')]),

    dict(title='dr', first='Shantanu', last='Ganguly',
         designation='Director (Library Operations)', institute='HDFC Library, Ashoka University, Sonipat, Haryana', country='India',
         linkedin='https://in.linkedin.com/in/shantanu-ganguly',
         img_url='https://etd2026.iitd.ac.in/wp-content/uploads/2026/10/shantanuGanguly.jpg',
         img_name='shantanu_ganguly.jpg',
         is_keynote=False,
         talks=[('From Archive to Algorithm: Cultural and Historical Informatics as Research Infrastructure in the Digital Humanities', 'Invited Talk')]),

    dict(title='dr', first='Tamal Kumar', last='Guha',
         designation='Librarian', institute='Lakshminath Bezbaroa Central Library, IIT Guwahati', country='India',
         linkedin='https://www.linkedin.com/in/tamalguha/',
         img_url='https://etd2026.iitd.ac.in/wp-content/uploads/2026/08/tamal-g.jpg',
         img_name='tamal_guha.jpg',
         is_keynote=False,
         talks=[('From Repository to Intelligence: Turning Electronic Theses into an Impact Analytics Platform', 'Invited Talk')]),

    dict(title='dr', first='Usha Mujoo', last='Munshi',
         designation='Chief Librarian', institute='India International Centre, New Delhi', country='India',
         website='https://www.teriin.org/events/icdl/img/speakers/bionote/Usha-M-Munshi.pdf',
         img_url='https://etd2026.iitd.ac.in/wp-content/uploads/2026/02/33502393_10157580335902516_275666115047194624_n-255x300.jpg',
         img_name='usha_munshi.jpg',
         is_keynote=False,
         talks=[('Data Visitation and Federated Learning: A Cross-Sector Imperative for Privacy-Preserving AI', 'Invited Talk')]),

    dict(title='dr', first='Wasim', last='Arif',
         designation='Associate Professor', institute='NIT Silchar', country='India',
         website='https://ec.nits.ac.in/faculties/wasim-arif',
         img_url='https://etd2026.iitd.ac.in/wp-content/uploads/2026/08/IMG_1751969560686cef180961a-scaled.jpg',
         img_name='wasim_arif.jpg',
         is_keynote=False,
         talks=[('Beyond Plagiarism: The Coming Crisis of Epistemic Authenticity in Graduate Research', 'Invited Talk')]),

    # ── PANEL DISCUSSION (3 more, Arend + Julien already above) ──
    dict(title='ms', first='Heather Greer', last='Klein',
         designation='Community Manager', institute='Samvera Foundation', country='USA',
         website='https://samvera.org/the-community/community-leadership',
         img_url='https://etd2026.iitd.ac.in/wp-content/uploads/2026/06/heather.jpg',
         img_name='heather_greer_klein.jpg',
         is_keynote=False,
         talks=[('Panel Discussion', 'Panel Discussion')]),

    dict(title='prof', first='M.', last='Madhan',
         designation='Director, Global Library & Professor', institute='O.P. Jindal University, Haryana', country='India',
         website='https://dstcpriisc.org/madhan-muthu/',
         img_url='https://etd2026.iitd.ac.in/wp-content/uploads/2026/02/Muthu-Madhan-150x150.png',
         img_name='m_madhan.png',
         is_keynote=False,
         talks=[('Panel Discussion', 'Panel Discussion')]),

    dict(title='prof', first='Supreet Singh', last='Bahga',
         designation='Associate Dean Academics', institute='IIT Delhi', country='India',
         website='https://web.iitd.ac.in/~bahga/',
         img_url='https://etd2026.iitd.ac.in/wp-content/uploads/2026/10/SupreetBahga_2026.jpeg',
         img_name='supreet_bahga.jpeg',
         is_keynote=False,
         talks=[('Panel Discussion', 'Panel Discussion')]),

    dict(title='dr', first='Umeshareddy', last='Kacherki',
         designation='Librarian & Head', institute='IISc Bengaluru', country='India',
         linkedin='https://in.linkedin.com/in/umesh-reddy-8a55b52',
         img_url='https://etd2026.iitd.ac.in/wp-content/uploads/2026/10/umesh-reddy.jpg',
         img_name='umeshareddy_kacherki.jpg',
         is_keynote=False,
         talks=[('Panel Discussion', 'Panel Discussion')]),

    # ── LIGHTNING TALK (6) ──
    dict(title='dr', first='Badan', last='Barman',
         designation='Assistant Professor', institute='Gauhati University', country='India',
         website='http://www.badanbarman.in/',
         img_url='https://etd2026.iitd.ac.in/wp-content/uploads/2026/10/badanBarman.png',
         img_name='badan_barman.png',
         is_keynote=False,
         talks=[('Bridging ETDs and People Who Need It: How LIS Links Can Power Dissemination, Knowledge Sharing and Professional Networking', 'Lightning Talk')]),

    dict(title='mr', first='Baiju', last='Joy',
         designation='College Librarian', institute='St. Stephens College, Pathanapuram, Kerala', country='India',
         img_url='https://etd2026.iitd.ac.in/wp-content/uploads/2026/10/BaijuJoy.jpeg',
         img_name='baiju_joy.jpeg',
         is_keynote=False,
         talks=[('Creation of Inclusive and Accessible Digital Spaces: ETDs in the Age of AI', 'Lightning Talk')]),

    dict(title='dr', first='Kannan', last='P',
         designation='Librarian', institute='IIT Gandhinagar', country='India',
         linkedin='https://in.linkedin.com/in/kannan-p-07761624',
         img_url='https://etd2026.iitd.ac.in/wp-content/uploads/2026/10/kannanP.png',
         img_name='kannan_p.png',
         is_keynote=False,
         talks=[('Beyond the Repository: Transforming Scholarly Outputs into Research Insights at IIT Gandhinagar', 'Lightning Talk')]),

    dict(title='dr', first='Parveen', last='Babbar',
         designation='Deputy Librarian', institute='JNU, New Delhi', country='India',
         linkedin='https://in.linkedin.com/in/parveen-babbar-7b8059a9',
         img_url='https://etd2026.iitd.ac.in/wp-content/uploads/2026/10/parveenBabbar.png',
         img_name='parveen_babbar.png',
         is_keynote=False,
         talks=[('Generative AI in Thesis Creation and Scholarly Writing', 'Lightning Talk')]),

    dict(title='dr', first='Santosh C.', last='Hulagabali',
         designation='University Librarian', institute='Central University of Haryana', country='India',
         website='https://www.cuh.ac.in/librarian.aspx',
         img_url='https://etd2026.iitd.ac.in/wp-content/uploads/2026/10/santoshHulagbali.jpg',
         img_name='santosh_hulagabali.jpg',
         is_keynote=False,
         talks=[('Navigating Regional-Language ETDs Across Digital Platforms: A Researcher\'s Perspective', 'Lightning Talk')]),

    dict(title='dr', first='Sanjay', last='Vats',
         designation='Project Lead', institute='Information Management, Vedanta Limited (Cairn Oil & Gas)', country='India',
         img_url='https://etd2026.iitd.ac.in/wp-content/uploads/2026/10/sanjayVats.jpeg',
         img_name='sanjay_vats.jpeg',
         is_keynote=False,
         talks=[('Metadata for Audio-Visual Research Outputs in ETD Repositories: Interoperability, Preservation, and AI Readiness', 'Lightning Talk')]),
]


# ═══════════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════════
def fmt_time(t_obj):
    """Convert time(14,30) → '02:30 PM'"""
    if not t_obj:
        return ''
    h = t_obj.hour
    m = t_obj.minute
    ampm = 'AM' if h < 12 else 'PM'
    h12 = h if h <= 12 else h - 12
    if h12 == 0:
        h12 = 12
    return f"{h12:02d}:{m:02d} {ampm}"


def find_session(title_substring):
    """Find first ScheduleSession whose title contains the substring."""
    for s in ScheduleSession.objects.all():
        if title_substring.lower() in s.title.lower():
            return s
    return None


def main():
    print('\n═══ ETD 2026 SPEAKER SEED ═══\n')

    # ── FLUSH ──
    n_talks = SpeakerTalk.objects.count()
    n_speakers = Speaker.objects.count()
    SpeakerTalk.objects.all().delete()
    Speaker.objects.all().delete()
    print(f'🗑  Flushed: {n_speakers} speakers, {n_talks} talks')

    # Delete old photos (both speakers/ and speakers/photos/)
    old_dir = os.path.join(BASE_DIR, 'media', 'speakers')
    for f in os.listdir(old_dir):
        fp = os.path.join(old_dir, f)
        if os.path.isfile(fp):
            os.remove(fp)
    # Also clean speakers/photos/ if exists
    if os.path.exists(MEDIA_DIR):
        for f in os.listdir(MEDIA_DIR):
            fp = os.path.join(MEDIA_DIR, f)
            if os.path.isfile(fp):
                os.remove(fp)
    print(f'🗑  Cleaned old photos\n')

    # ── CREATE SPEAKERS ──
    downloaded = 0
    skipped = 0
    failed_img = 0
    created = 0
    total_talks = 0
    unlinked = []

    for idx, s in enumerate(SPEAKERS, 1):
        img_path = os.path.join(MEDIA_DIR, s['img_name'])

        # Download photo
        try:
            if not os.path.exists(img_path):
                urllib.request.urlretrieve(s['img_url'], img_path)
                downloaded += 1
            else:
                skipped += 1
        except Exception as e:
            print(f'   ❌ Photo failed: {s["first"]} {s["last"]}: {e}')
            failed_img += 1

        # Create Speaker
        try:
            speaker = Speaker.objects.create(
                title=s['title'],
                first_name=s['first'],
                last_name=s['last'],
                designation=s['designation'],
                institute=s['institute'],
                country=s['country'],
                bio='',  # Left blank as requested
                photo=f'speakers/photos/{s["img_name"]}',
                website_url=s.get('website', ''),
                linkedin_url=s.get('linkedin', ''),
                is_keynote=s['is_keynote'],
                is_active=True,
                display_order=idx,
            )
            created += 1
        except Exception as e:
            print(f'❌ DB Error: {s["first"]} {s["last"]}: {e}')
            continue

        # Create SpeakerTalk(s) linked to schedule
        for talk_idx, (talk_title, talk_track) in enumerate(s.get('talks', [])):
            # Find matching session
            # Use first few words of talk title or track to find session
            session = None
            if 'Keynote' in talk_track and 'Keynote' in talk_title:
                # Match by keynote number
                if 'Saral' in talk_title:
                    session = find_session('Keynote Address – 1')
                elif 'Next Evolution' in talk_title:
                    session = find_session('Keynote Address – 2')
                elif 'Show Your Working' in talk_title:
                    session = find_session('Keynote Address – 3')
                elif 'Internet Archive' in talk_title:
                    session = find_session('Technical Session 9')
            elif 'Welcome' in talk_track:
                session = find_session('Inaugural')
            elif 'Guest of Honour' in talk_track:
                if 'Devika' in s['first'] or 'Madalli' in s['last']:
                    session = find_session('Inaugural')
                elif 'Uma' in s['first']:
                    session = find_session('Concluding')
                elif 'Julien' in s['first']:
                    session = find_session('Concluding')
            elif 'NDLTD' in talk_track:
                session = find_session('Inaugural')
            elif 'IFLA' in talk_track:
                session = find_session('Inaugural')
            elif 'Presidential' in talk_track:
                if 'Arvind' in s['first']:
                    session = find_session('Inaugural')
                elif 'Ashwini' in s['first']:
                    session = find_session('Concluding')
            elif 'Vote' in talk_track:
                session = find_session('Inaugural')
            elif 'Chief Guest' in talk_track:
                session = find_session('Concluding')
            elif 'Workshop' in talk_track:
                session = find_session('Workshop on Dryad')
            elif 'Invited Talk' in talk_track:
                # Match by session content — search all sessions for speaker name
                full_name = f"{s['first']} {s['last']}"
                for sess in ScheduleSession.objects.filter(session_type__in=['technical', 'keynote']):
                    if full_name.lower() in sess.description.lower():
                        session = sess
                        break
            elif 'Panel' in talk_track:
                session = find_session('Panel Discussion')
            elif 'Lightning' in talk_track:
                session = find_session('Technical Session 7')

            talk_date = session.date if session else None
            talk_time = fmt_time(session.start_time) if session else ''

            SpeakerTalk.objects.create(
                speaker=speaker,
                title=talk_title,
                abstract='',
                track=talk_track,
                talk_date=talk_date,
                talk_time=talk_time,
                display_order=talk_idx + 1,
            )
            total_talks += 1

            if not session:
                unlinked.append(f"{s['first']} {s['last']} — {talk_title}")

        print(f'  ✅ {s["first"]} {s["last"]} ({len(s.get("talks", []))} talk(s))')

    # ── REPORT ──
    print(f'\n═══ DONE ═══')
    print(f'Speakers created:  {created}')
    print(f'Photos downloaded: {downloaded} (skipped {skipped}, failed {failed_img})')
    print(f'SpeakerTalks:      {total_talks}')
    if unlinked:
        print(f'\n⚠  {len(unlinked)} talk(s) could not be linked to a schedule session:')
        for u in unlinked:
            print(f'   • {u}')
    print(f'\n📁 Photos in media/speakers/photos/: {len(os.listdir(MEDIA_DIR))} files')


if __name__ == '__main__':
    main()
