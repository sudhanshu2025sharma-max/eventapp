"""
ETD 2026 Full Program Seeder — Flushes & reloads schedule + papers + posters.

Usage:
  python3 manage.py seed_etd2026                              # Oct 23-25, 2026
  python3 manage.py seed_etd2026 --rebase-start 2025-12-15    # Day 1=Dec 15
  python3 manage.py seed_etd2026 --rebase-start today         # Day 1=today (test meals)
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from datetime import date, time, timedelta, datetime


def t(h, m):
    return time(h, m)


# ═══════════════════════════════════════════════════════════════
#  SCHEDULE — Day 1 (Oct 23) · Day 2 (Oct 24) · Day 3 (Oct 25)
# ═══════════════════════════════════════════════════════════════
SCHEDULE = [
    # ─────────────────── DAY 1 — Friday, Oct 23 ───────────────────
    dict(day=1, order=1, start=t(7,0), end=t(8,45),
         title='Breakfast', stype='meal', room='Red Square',
         is_meal=True, meal_category='Breakfast', featured=False, desc='', subs=[]),

    dict(day=1, order=2, start=t(8,0), end=t(9,15),
         title='Registration / Kit Collection', stype='special',
         room='Main Lobby', is_meal=False, meal_category='',
         featured=False, desc='', subs=[]),

    dict(day=1, order=3, start=t(9,30), end=t(11,0),
         title='Inaugural Session', stype='ceremony',
         room='Seminar Hall, Main Building', is_meal=False, meal_category='',
         featured=True, desc='Opening ceremony and addresses',
         subs=[
             ('Assembly at the Seminar Hall', t(9,15), t(9,25), ''),
             ('Lighting of Lamp', t(9,25), t(9,30), ''),
             ('Overview and Introduction to ETD-2026', t(9,31), t(9,35),
              'Dr. Nabi Hasan, Organising Chair & Head Librarian, IIT Delhi'),
             ('Welcome Address', t(9,36), t(9,40),
              'Prof. Ramesh C Gaur, Conference Committee Chair, NDLTD, USA & Dean, Faculty of Arts and Design, South Asian University, New Delhi'),
             ('Address by Executive Director, NDLTD, USA', t(9,41), t(9,45),
              'Prof. Edward A. Fox, Executive Director & Chairman of the Board for NDLTD, USA'),
             ('Address by IFLA President', t(9,46), t(9,50),
              'Ms. Leslie Weir, IFLA President (2025-2027) & Librarian and Archivist of Canada'),
             ('Address by the Chief Guest', t(9,51), t(10,0), 'To be decided'),
             ('Address by the Guest of Honour', t(10,1), t(10,15),
              'Prof. Devika Madalli, Director, INFLIBNET Centre, Gandhinagar'),
             ('Presidential Address', t(10,16), t(10,20),
              'Prof. Arvind K Nema, Deputy Director (Operations) / Officiating Director, IIT Delhi'),
             ('Vote of Thanks', t(10,21), t(10,25),
              'Prof. B. J. Alappat, ACL Chairperson, IIT Delhi'),
         ]),

    dict(day=1, order=4, start=t(10,26), end=t(11,10),
         title='High Tea & Exhibition Inauguration', stype='meal',
         room='Exhibition Area', is_meal=True, meal_category='High Tea',
         featured=False, desc='Group Photo, Inauguration of Exhibition and High Tea', subs=[]),

    dict(day=1, order=5, start=t(11,11), end=t(13,0),
         title='Workshop on Dryad: Publish and Preserve Your Data', stype='workshop',
         room='Seminar Hall', is_meal=False, meal_category='', featured=False,
         desc='Jennifer Gibson, Executive Director, Dryad & Kailasha Purushothaman, Data Curator, Dryad',
         subs=[]),

    dict(day=1, order=6, start=t(13,1), end=t(13,45),
         title='Lunch Break & Visit to Exhibition Area', stype='meal',
         room='Dining Area', is_meal=True, meal_category='Lunch',
         featured=False, desc='', subs=[]),

    dict(day=1, order=7, start=t(13,46), end=t(14,15),
         title='Keynote Address – 1: Saral AI', stype='keynote',
         room='Seminar Hall', is_meal=False, meal_category='', featured=True,
         desc='Democratising Scholarly Work by Transforming into Accessible, Multilingual Content — Prof. Ponnurangam Kumaraguru, Visiting Scientist, Anusandhan National Research Foundation (ANRF), Govt. of India',
         subs=[]),

    dict(day=1, order=8, start=t(14,16), end=t(16,5),
         title='Technical Session 1', stype='technical',
         room='Seminar Hall', is_meal=False, meal_category='', featured=False,
         desc='Next-Generation ETDs: AI, Infrastructure, Interoperability & Sustainable Stewardship. Chaired by Prof. Yogendra Singh, University Librarian, SRH University, Dehradun. Session Coordinator: Dr. Mohd Asif Khan, Indian Institute of Management, Kashipur',
         subs=[
             ('INFLIBNET @ETD-2026 — An Integrated National Scholarly Ecosystem', t(14,16), t(14,55),
              'Mr. Manoj Kumar K, Scientist F-CS INFLIBNET & Centre Team, Gandhinagar'),
             ('Invited Talk — Legible to Whom? Machine Readership, Epistemic Justice and the Stewardship of Next-Generation ETDs', t(14,56), t(15,15),
              'Prof. Ajay Pratap Singh, University of Delhi (Former Director General, National Library of India and RRRLF)'),
             ('Invited Talk — One Nation One Subscription (ONOS): A Strategic Imperative', t(15,16), t(15,35),
              'Dr. Hafsa Ahmad, Scientist D, Office of the Principal Scientific Adviser, Government of India'),
             ('Insight Paper Presentations', t(15,36), t(16,5), ''),
         ]),

    dict(day=1, order=9, start=t(16,6), end=t(16,25),
         title='Tea Break & Visit to Exhibition Area', stype='break',
         room='Exhibition Area', is_meal=True, meal_category='Tea Break',
         featured=False, desc='', subs=[]),

    dict(day=1, order=10, start=t(16,26), end=t(18,5),
         title='Technical Session 2', stype='technical',
         room='Seminar Hall', is_meal=False, meal_category='', featured=False,
         desc='Transforming the ETD Lifecycle: Workflows, AI-Enabled Management, Curation & Reuse. Chaired by Ms. Kiran Chauhan, Director, DESIDOC, Delhi. Session Coordinator: Dr. Ranjit Kumar Das, IIT Bombay',
         subs=[
             ('Fireside Chat', t(16,26), t(16,45), 'Guest and Host: To be confirmed'),
             ('Experiential Papers', t(16,46), t(17,5), ''),
             ('Insight Paper Presentations', t(17,6), t(17,25), ''),
             ('Poster Presentations', t(17,26), t(18,5),
              'Moderator: Dr. Satish Malik, University Librarian, MDU Rohtak & Prof. Nirmal Kumar Swain, Head DLIS, MDU Rohtak'),
         ]),

    dict(day=1, order=11, start=t(18,6), end=t(18,30),
         title='Guided Central Library Tour & Visit to Poster Area / Exhibition / Tea',
         stype='break', room='Central Library', is_meal=True, meal_category='Tea Break',
         featured=False, desc='', subs=[]),

    dict(day=1, order=12, start=t(18,31), end=t(20,0),
         title='Cultural Programme', stype='cultural',
         room='Seminar Hall', is_meal=False, meal_category='', featured=False,
         desc='', subs=[]),

    dict(day=1, order=13, start=t(20,1), end=t(22,0),
         title='Dinner', stype='meal',
         room='Dining Hall', is_meal=True, meal_category='Dinner',
         featured=False, desc='', subs=[]),

    # ─────────────────── DAY 2 — Saturday, Oct 24 ───────────────────
    dict(day=2, order=1, start=t(7,30), end=t(9,0),
         title='Breakfast', stype='meal', room='Red Square',
         is_meal=True, meal_category='Breakfast', featured=False, desc='', subs=[]),

    dict(day=2, order=2, start=t(9,15), end=t(9,45),
         title='Keynote Address – 2: The Next Evolution of ETDs', stype='keynote',
         room='Seminar Hall', is_meal=False, meal_category='', featured=True,
         desc='Reimagining Academic Knowledge in the Age of Generative AI — Mr. Kanwaljeet Singh Arora, AI & Blockchain Consultant and Trainer, Gurugram, Haryana',
         subs=[]),

    dict(day=2, order=3, start=t(9,45), end=t(11,10),
         title='Technical Session 3', stype='technical',
         room='Seminar Hall', is_meal=False, meal_category='', featured=False,
         desc='Advancing ETD Repositories: AI-Enabled Discovery, and Digital Resilience. Chaired by Dr. T. S. Kumbar, Advisor (Library & Institute Archives), IIT Gandhinagar. Session Coordinator: Dr. Naresh Bhandari, Deputy Librarian, IIT Mandi',
         subs=[
             ('Invited Talk — AI-enabled National Research Discovery Platform', t(9,46), t(10,5),
              'Prof. A.R.D. Prasad, Former Professor, DRTC (ISI), Bengaluru'),
             ('Invited Talk — Preservation with Resilience: Strategic Disaster Recovery Planning for Institutional Repositories', t(10,6), t(10,25),
              'Dr. Saiful Amin, Director, Semantic Consulting Services Pvt. Ltd., Bengaluru'),
             ('Insight Paper Presentations', t(10,26), t(10,55), ''),
             ('Industry Presentation', t(10,56), t(11,10), 'Clarivate'),
         ]),

    dict(day=2, order=4, start=t(9,31), end=t(13,0),
         title='Ideathon — Live Collaborative Library Innovation Challenge',
         stype='ideathon', room='Board Room, IIT Delhi',
         is_meal=False, meal_category='', featured=False, is_parallel=True,
         desc='Parallel Track — runs alongside main programme', subs=[]),

    dict(day=2, order=5, start=t(11,11), end=t(11,20),
         title='Tea Break & Visit to Exhibition Area', stype='break',
         room='Exhibition Area', is_meal=True, meal_category='Tea Break',
         featured=False, desc='', subs=[]),

    dict(day=2, order=6, start=t(11,21), end=t(13,0),
         title='Technical Session 4', stype='technical',
         room='Seminar Hall', is_meal=False, meal_category='', featured=False,
         desc='ETD Analytics & Research Impact: Visibility, Metrics & Emerging Trends. Chaired by Dr. Nishat Fatima, Librarian and Professor, AMU. Session Coordinator: Dr. Kumar Sanjay, Director, Library, NITI Aayog',
         subs=[
             ('Invited Talk — Building ETD Visibility, Usage, and Impact with Persistent Identifiers and Open Metadata', t(11,21), t(11,40),
              'Mohamad Mostafa — Use Cases from Australia, Tunisia, and Côte d\'Ivoire'),
             ('Invited Talk — Making India\'s Research Count: Visibility, Trust and Impact in the Age of AI', t(11,41), t(12,0),
              'Arend Kuester, Country Manager India, Springer Nature'),
             ('Insight Paper Presentations', t(12,1), t(12,50), ''),
             ('Industry Presentations', t(12,51), t(13,0), 'DrillBit Softtech India Pvt Ltd & DELNET'),
         ]),

    dict(day=2, order=7, start=t(13,1), end=t(13,45),
         title='Lunch Break & Visit to Exhibition Area', stype='meal',
         room='Dining Area', is_meal=True, meal_category='Lunch',
         featured=False, desc='', subs=[]),

    dict(day=2, order=8, start=t(13,46), end=t(15,45),
         title='Technical Session 5.1 — AI-Driven ETD Discovery', stype='technical',
         room='Seminar Hall', is_meal=False, meal_category='', featured=False,
         desc='Metadata, Semantics & Intelligent Access. Chaired by Dr. Sili Rout, Deputy Director (Research), ICSSR. Session Coordinator: Dr. Asif Fareed Siddiqui, Deputy Librarian, AMU',
         subs=[
             ('Invited Talk — Beyond Preservation: Bridging the Metadata Expertise Gap for Multilingual ETDs with AI', t(13,46), t(14,5),
              'Dr. Kshema Prakash, Librarian, The English and Foreign Languages University, Hyderabad'),
             ('Invited Talk — From Repository to Intelligence: Turning Electronic Theses into an Impact Analytics Platform', t(14,6), t(14,25),
              'Dr. Tamal Kumar Guha, Librarian, IIT Guwahati'),
             ('Invited Talk — Next Generation ETDs: Metadata, Interoperability, Institutional Repositories (Case Study ISI Kolkata)', t(14,26), t(14,45),
              'Dr. Kishor Satpathy, Chief Librarian, Indian Statistical Institute, Kolkata'),
             ('Insight Paper Presentations', t(14,46), t(15,25), ''),
             ('Industry Presentations', t(15,26), t(15,45), 'IEEE & VIR Softech Pvt Ltd'),
         ]),

    dict(day=2, order=9, start=t(13,46), end=t(15,45),
         title='Technical Session 5.2 — AI-Driven ETD Discovery (Parallel)',
         stype='technical', room='Senate Room', is_meal=False, meal_category='',
         featured=False, is_parallel=True,
         desc='Metadata, Semantics & Intelligent Access. Chaired by Prof. Sewa Singh, Ex. Guru Nanak Dev University, Amritsar. Session Coordinator: Dr. Faizul Nisha, DRDO',
         subs=[
             ('Invited Talk — From Scan to Oblivion? Agentic AI and the Vicious Circles of Thesis Digitisation', t(13,46), t(14,5),
              'Dr. Jean-Charles LAMIREL, Associate Professor, University of Strasbourg, France'),
             ('Invited Talk — Transforming ETD Management: Best Practices, Workflows, Metadata Standards, and Digital Preservation', t(14,6), t(14,25),
              'Dr. Manju Naika, Chief Library Officer, IIT Bombay'),
             ('Insight Paper Presentations', t(14,26), t(15,25), ''),
             ('Industry Presentations', t(15,26), t(15,45), 'ExpertEdge - by Packt & IGIN Knowledge Services (iGroup)'),
         ]),

    dict(day=2, order=10, start=t(15,46), end=t(16,10),
         title='Tea Break & Visit to Exhibition Area', stype='break',
         room='Exhibition Area', is_meal=True, meal_category='Tea Break',
         featured=False, desc='', subs=[]),

    dict(day=2, order=11, start=t(16,11), end=t(18,10),
         title='Technical Session 6.1 — Responsible AI in ETDs', stype='technical',
         room='Seminar Hall', is_meal=False, meal_category='', featured=False,
         desc='Ethics, Integrity, Policy Standards, Copyright & Governance. Chaired by Dr. Rajesh Singh, University Librarian and Head, DULS, University of Delhi. Session Coordinator: Mr. Sudhanshu Bhushan, Scientist-F, DESIDOC',
         subs=[
             ('Invited Talk — AI-Generated Hallucinated Citations: A Threat to the Integrity of Scholarly Research and ETDs', t(16,11), t(16,30),
              'Dr. Sangeeta Kaul, Director, DELNET, New Delhi'),
             ('Invited Talk — Data Visitation and Federated Learning: A Cross-Sector Imperative for Privacy-Preserving AI', t(16,31), t(16,50),
              'Dr. Usha Mujoo Munshi, Chief Librarian, India International Centre, New Delhi'),
             ('Insight Paper Presentations', t(16,51), t(17,50), ''),
             ('Industry Presentations', t(17,51), t(18,10), 'BSB EDGE Pvt. Ltd. & World Scientific Publishing'),
         ]),

    dict(day=2, order=12, start=t(16,11), end=t(18,10),
         title='Technical Session 6.2 — AI in ETD Creation (Parallel)',
         stype='technical', room='Senate Room', is_meal=False, meal_category='',
         featured=False, is_parallel=True,
         desc='Writing, Literature Review, & Submission. Chaired by Dr. P.K. Jain, Former Librarian, Institute of Economic Growth. Session Coordinator: Mr. Yogesh Modi, Scientist-F, DESIDOC',
         subs=[
             ('Invited Talk — From Repository to Policy: Developing a Scholarly Gateway for Indian Foreign Policy Theses', t(16,11), t(16,30),
              'Dr. Ramesh Yernagula, Director (L&I), Ministry of External Affairs, GoI'),
             ('Invited Talk — From Vision to a Global Knowledge Commons: The Genesis, Evolution, and Impact of Shodhganga', t(16,31), t(16,50),
              'Dr. Jagdish Arora, Advisor, NBA and Former Director, INFLIBNET'),
             ('Invited Talk — One Institution, One Journal: Reimagining Indian Academic Publishing', t(16,51), t(17,10),
              'Dr. Sandeep Kumar Pathak, Librarian, IISER Bhopal'),
             ('Insight Paper Presentations', t(17,11), t(17,50), ''),
             ('Industry Presentations', t(17,51), t(18,10), 'KGL Accucoms, Statista India, Total Library Solutions'),
         ]),

    dict(day=2, order=13, start=t(17,0), end=t(18,0),
         title='IITs Library Professionals Meet', stype='special',
         room='Learning Commons, Central Library', is_meal=False, meal_category='',
         featured=False, is_parallel=True, desc='', subs=[]),

    dict(day=2, order=14, start=t(18,11), end=t(18,30),
         title='Guided Central Library Tour & Poster Area Tea', stype='break',
         room='Central Library', is_meal=True, meal_category='Tea Break',
         featured=False, desc='', subs=[]),

    dict(day=2, order=15, start=t(19,31), end=t(21,0),
         title='Cultural Evening & Gala Dinner', stype='cultural',
         room='Dining Hall', is_meal=True, meal_category='Dinner',
         featured=False,
         desc='Live Karaoke Music / Standup Comedy / Self-composed Poetry',
         subs=[]),

    # ─────────────────── DAY 3 — Sunday, Oct 25 ───────────────────
    dict(day=3, order=1, start=t(7,30), end=t(9,0),
         title='Breakfast', stype='meal', room='Red Square',
         is_meal=True, meal_category='Breakfast', featured=False, desc='', subs=[]),

    dict(day=3, order=2, start=t(9,15), end=t(9,45),
         title='Keynote Address – 3: Show Your Working', stype='keynote',
         room='Seminar Hall', is_meal=False, meal_category='', featured=True,
         desc='ETDs and the Evidence of Thinking — Shameem Nilofar Maideen, University Librarian, Singapore Management University, Singapore',
         subs=[]),

    dict(day=3, order=3, start=t(9,45), end=t(11,15),
         title='Technical Session 7', stype='technical',
         room='Seminar Hall', is_meal=False, meal_category='', featured=False,
         desc='Dynamic ETDs: Recommendation Systems & Immersive Scholarship. Chaired by Dr. Mahendra N. Jadhav, Former Librarian, IIT Madras. Session Coordinator: Dr. Samar Iqbal Bakhshi, Deputy Librarian, National Law University Delhi',
         subs=[
             ('Invited Talk — The Post-Boolean Librarian: Semantic Search for ETDs through Tool RAG and Richer Metadata', t(9,46), t(10,5),
              'Prof. Parthasarathi Mukhopadhyay, Kalyani University, West Bengal'),
             ('Lightning Talks (7 min each)', t(10,6), t(10,50),
              'Moderator: Prof. Sanjay Kataria, Director, LRC, Bennett University, Greater Noida'),
             ('Insight Paper Presentations', t(10,51), t(11,10), ''),
             ('Industry Presentations', t(11,11), t(11,15), 'Cambridge University Press & Taylor & Francis'),
         ]),

    dict(day=3, order=4, start=t(11,16), end=t(11,30),
         title='Tea Break & Visit to Exhibition Area', stype='break',
         room='Exhibition Area', is_meal=True, meal_category='Tea Break',
         featured=False, desc='', subs=[]),

    dict(day=3, order=5, start=t(11,31), end=t(13,0),
         title='Technical Session 8.1 — The Future of ETDs', stype='technical',
         room='Seminar Hall', is_meal=False, meal_category='', featured=False,
         desc='AI, Open Science & Global Access. Chaired by Dr. Pardeep Rai, President, Indian Library Association. Session Coordinator: Dr. Navin Upadhyay, Deputy Librarian, IIT (BHU) Varanasi',
         subs=[
             ('Invited Talk — Building a Digital Scholarly System: Institutional Repository and Digital Library Services at Nalanda Library, IIT Ropar', t(11,31), t(11,50),
              'Dr. Dinesh K. S., Librarian & Registrar, IIT Ropar'),
             ('Invited Talk — From Archive to Algorithm: Cultural and Historical Informatics as Research Infrastructure in the Digital Humanities', t(11,51), t(12,10),
              'Dr. Shantanu Ganguly, Director, Library Services, Ashoka University'),
             ('Insight Paper Presentations', t(12,11), t(12,50), ''),
             ('Industry Presentations', t(12,51), t(13,0), 'Sage Research Methods & Springer Nature'),
         ]),

    dict(day=3, order=6, start=t(11,31), end=t(13,0),
         title='Technical Session 8.2 — The Future of ETDs (Parallel)',
         stype='technical', room='Senate Room', is_meal=False, meal_category='',
         featured=False, is_parallel=True,
         desc='AI, Open Science & Global Access. Chaired by Dr. R.K. Sharma, Ex DG, Delhi Public Library. Session Coordinator: Dr. Akhtar Hussain, Head, Library, IMT Ghaziabad',
         subs=[
             ('Invited Talk — From Manuscript Digitisation to Knowledge Extraction: Transforming India\'s Manuscript Heritage', t(11,31), t(11,50),
              'Dr. Akhtar Parvez, University Librarian, Jamia Hamdard, New Delhi'),
             ('Invited Talk — Open Metadata and Open Knowledge: Towards a National Policy', t(11,51), t(12,10),
              'Dr. Nihar K. Patra, Librarian, IIT Roorkee'),
             ('Insight Paper Presentations', t(12,11), t(12,50), ''),
             ('Industry Presentations', t(12,51), t(13,0), 'Turnitin & De Gruyter Brill'),
         ]),

    dict(day=3, order=7, start=t(13,1), end=t(13,45),
         title='Lunch Break & Visit to Exhibition Area', stype='meal',
         room='Dining Area', is_meal=True, meal_category='Lunch',
         featured=False, desc='', subs=[]),

    dict(day=3, order=8, start=t(13,46), end=t(15,35),
         title='Technical Session 9', stype='technical',
         room='Seminar Hall', is_meal=False, meal_category='', featured=False,
         desc='Global ETD Ecosystems: Consortia, Networks, Platforms & Institutional Practices. Chaired by Prof. Naushad Ali, Professor of LIS, AMU. Session Coordinator: Dr. K. G. Sudhier, Assistant Professor, Central University of Tamil Nadu',
         subs=[
             ('Keynote Address – 4 — How Can the Internet Archive Help? Preserving the Open Thesis Record', t(13,46), t(14,10),
              'Mr. Julien Masanes, Co-founder, Internet Archive Europe'),
             ('Invited Talk — Beyond Plagiarism: The Coming Crisis of Epistemic Authenticity in Graduate Research', t(14,11), t(14,25),
              'Dr. Wasim Arif, Associate Professor, NIT Silchar'),
             ('Invited Talk — Beyond the PDF: Electronic Theses as Structured, Linked, and Responsibly Published Scholarship', t(14,26), t(14,40),
              'Prof. Arjun Ghosh, Digital Humanities, HUSS, IIT Delhi'),
             ('Ideathon Presentations (5 min each team)', t(14,41), t(15,5),
              'Moderators: Pankaj Chaurasia, ALIO, PM Museum & Library & Dr. Mallikarjuna C., Deputy Librarian, IIT Hyderabad'),
             ('Insight Paper Presentations', t(15,6), t(15,25), ''),
             ('Industry Presentations', t(15,26), t(15,35), 'RSC Gold & Taylor & Francis Group'),
         ]),

    dict(day=3, order=9, start=t(15,36), end=t(15,55),
         title='Tea Break & Visit to Exhibition Area', stype='break',
         room='Exhibition Area', is_meal=True, meal_category='Tea Break',
         featured=False, desc='', subs=[]),

    dict(day=3, order=10, start=t(15,56), end=t(17,0),
         title='Panel Discussion', stype='panel',
         room='Seminar Hall', is_meal=False, meal_category='', featured=False,
         desc='Moderator: G. Mahesh, CSIR, Govt. of India, New Delhi. Panellists: Dr. Umeshareddy Kacherki, Librarian & Head, IISc Bengaluru; Ms. Heather Greer Klein, Community Manager, Samvera Foundation, USA; Prof. Supreet Singh Bahga, Associate Dean - Academics, IIT Delhi; Prof. M. Madhan, Director, Global Library & Professor, O.P. Jindal University; Mr. Arend Kuester, Country Manager India, Springer Nature',
         subs=[]),

    dict(day=3, order=11, start=t(17,1), end=t(18,30),
         title='Concluding Session', stype='ceremony',
         room='Seminar Hall', is_meal=False, meal_category='', featured=True,
         desc='Conference report, awards and closing addresses',
         subs=[
             ('Gather at the Seminar Hall', t(17,1), t(17,5), ''),
             ('Welcome Address', t(17,6), t(17,10),
              'Dr. Shankar Chavan, Deputy Librarian, IIT Delhi'),
             ('Conference Report', t(17,11), t(17,20),
              'Dr. Kshema Prakash, Rapporteur General / Librarian, EFLU Telangana'),
             ('Awards Ceremony — NDLTD Awards, Best Insight/Experiential Paper, Lightning Talk, Poster, Innovation (Ideathon)', t(17,21), t(17,30), ''),
             ('Address by Guest of Honour', t(17,31), t(17,40),
              'Prof. Uma Kanjilal, Vice-Chancellor, IGNOU, New Delhi'),
             ('Address by Guest of Honour', t(17,41), t(17,48),
              'Mr. Julien Masanes, Co-founder, Internet Archive Europe'),
             ('Address by Chief Guest', t(17,49), t(18,4),
              'Prof. Dhananjay Singh, Member Secretary, ICSSR'),
             ('Presidential Address', t(18,5), t(18,12),
              'Prof. Ashwini Agrawal, Dean R&D, IIT Delhi'),
             ('Vote of Thanks', t(18,13), t(18,20),
              'Dr. Neeraj Chaurasia, Organising Secretary / Deputy Librarian, IIT Delhi'),
         ]),

    dict(day=3, order=12, start=t(18,21), end=t(19,30),
         title='High Tea & Certificate Distribution', stype='meal',
         room='Foyer', is_meal=True, meal_category='High Tea',
         featured=False, desc='', subs=[]),
]


# ═══════════════════════════════════════════════════════════════
#  FULL PAPERS — 46 papers, EXACT IDs & titles from Full Papers HTML
#  Authors preserved ONLY where program schedule explicitly listed them.
# ═══════════════════════════════════════════════════════════════
FULL_PAPERS = [
    # (paper_id, title, authors_from_schedule_if_available)
    ("ETD2026-SUB-087", "Comparative Perspectives on Global ETD Repositories, Repository Platforms and Scholarly Networks towards Intelligent Research Infrastructures", "Nisha S., Balasubramani R., Kanagadurgadevi S. & Annu"),
    ("ETD2026-SUB-129", "Efficient Data Migration Approach for Migrating Large-Scale ETD Repository: A Case Study of Shodhganga", "Manoj Kumar K, Vikas Pal, Rajan Kumar & Surbhi"),
    ("ETD2026-SUB-106", "ETD Recommendation System: Enriching The Scholarly Discovery in the Academic and Research Institutions of India", "Srijan Dey & Parikshit Mondal"),
    ("ETD2026-SUB-151", "Evaluating ETD Platforms: A Comparative Study of Shodhganga and Thesis.fr", "Ufaira Yaseen & Fayaz Ahmad Loan"),
    ("ETD2026-SUB-104", "Need and Acceptance of AI-Based Smart Search and Recommendation Systems in Electronic Theses and Dissertations (ETD) Repositories among PhD Scholars in Lucknow: An Extended Technology Model Investigation", "Deepali Patel & Pravish Prakash"),
    ("ETD2026-SUB-098", "Next-Generation ETD Infrastructure through REXI: An Integrated Open-Source Framework for Scholarly Communication", "Udayan Ghosh, Shantanu Ganguly, Satarupa Samanta & Sumit Sundar Ray"),
    ("ETD2026-SUB-143", "A Semantic Intelligent Framework for Electronic Thesis and Dissertation (ETD) Discovery", "Chitra Ghosh, Sanya Agarwal & Ankit Gupta"),
    ("ETD2026-SUB-028", "An Explainable Semantic Discovery Framework for Electronic Thesis and Dissertation Repositories Using Dense Retrieval and Grounded AI Assistance", "Mrigank Jaiswal, Sparsh Kumar & Shivam Yadav"),
    ("ETD2026-SUB-023", "Enhanced Metadata Generation for Electronic Theses and Dissertations(ETDs) Using NLP and Linked Data", "Sanjay"),
    ("ETD2026-SUB-175", "Enhancing the Discoverability of Electronic Theses and Dissertations through Artificial Intelligence and Semantic Technologies: A Review", "Partha Chattopadhyay & Arun Kumar Chakraborty"),
    ("ETD2026-SUB-091", "From Key Words to Semantic Discovery: An Observational Study of IR@NITR and AI Research Assistants", "Dibya Kishor Pradhan"),
    ("ETD2026-SUB-020", "Enhanced Interoperability in ETD Repositories Through Metadata Standards and Linked Data Technologies: A Case Study of Mangalayatan University", "Shukal Kumar & Anand Prakash Srivastava"),
    ("ETD2026-SUB-079", "Smart Retrieval of Electronic Theses and Dissertations from DSpace: Implementation of an Open-Source Framework for Repositories using the Model Context Protocol", "Tirtharaj Dasgupta, Jhantu Mazumder & Parthasarathi Mukhopadhyay"),
    ("ETD2026-SUB-088", "Transforming Electronic Thesis and Dissertation Systems through Artificial Intelligence: An AI-Enabled DSpace Framework for Academic Libraries", "Keerthna M, R. Balasubramani, Susan Babu, & Annu"),
    ("ETD2026-SUB-133", "User Perception and Research Efficiency of AI-Based ETD Discovery Systems in Academic Libraries", "RK Kishore Patnala, Jitendra Kumar Jain & Surendra Kumar Sahu"),
    ("ETD2026-SUB-061", "A Comparative Study on Open Access Government or Public Funded ETD Platforms: Challenges and Future Directions", "Inapanuri Abhinay, Kanu Chakraborty, Navin Upadhyay, Subhadip Mandal, & Simul Chakraborty"),
    ("ETD2026-SUB-042", "A Comprehensive Survey of the Landscape of Institutional Repositories in IITs", "Vijay Kumar, B. Kranthi Kumar & Nizam Husain"),
    ("ETD2026-SUB-138", "AI Literacy Among PhD Scholars of tricity—Bridging the New Academic Divide in Digital Scholarship", "Neha Sethi & Jivesh Bansal"),
    ("ETD2026-SUB-125", "Awareness and Strategic Use of Generative Artificial Intelligence (AI) in Academic Writing and Research Workflows", "Vijay Kumar Verma, Ankita Ghosh, Gunjan Mishra, Bhupendra Kumar, Satbir Chauhan & S Lubisa Chawang"),
    ("ETD2026-SUB-084", "Digital Repositories for ETDs: A Case Study Using Zotero Group Libraries for Developing Academic Repositories", "Goutham N. & K. G. Sudhier"),
    ("ETD2026-SUB-123", "Generative AI in M.Ed. Dissertation Writing: Practices, Perceptions and Implications for Research Ethics in Education", "Shivani"),
    ("ETD2026-SUB-136", "Bibliometric Analysis of Ph.D. Theses in Sanskrit: A Study Based on the Online Directory of Central Sanskrit University, New Delhi", "P. M. Gupta"),
    ("ETD2026-SUB-112", "ETD Beyond Storage: Integrating Citation Tracking into Shodhganga", "Syed Shaz Husain & Nishat Fatima"),
    ("ETD2026-SUB-128", "LIS Theses in the Scholarly Ecosystem: Trends, Visibility, and Citation Impact Abstract", "Aasif Ahmad Mir"),
    ("ETD2026-SUB-158", "Artificial Intelligence Research and ETD Readiness in Kuwait: A Bibliometric and Repository Assessment", "Parvez Ahmad & Wadhhah A. Ahmed"),
    ("ETD2026-SUB-075", "Mapping the Intellectual Structure of Electronic Theses and Dissertations (ETD) Research: A Bibliometric Analysis", ""),
    ("ETD2026-SUB-152", "Countering AI Misuse, Fostering Originality: Designing an Institutional Framework for Rubrics in Doctoral Assessment through Constructive Alignment", "L S Venkatesh"),
    ("ETD2026-SUB-141", "Ensuring Integrity in E-Theses and Dissertations Submission: The Role of Hash Values", "Prashanta Kumar Behera, Sanmati Jinendran Jain & Ramakant"),
    ("ETD2026-SUB-037", "Research Process Management: Improving Transparency and Reuse in Modern Research", "Snehasish Paul"),
    ("ETD2026-SUB-031", "Responsible AI in ETD: Ethical, Legal, and Governance Issues in Academic Repositories", "Vaishnavi Anil Ambade"),
    ("ETD2026-SUB-117", "Digital Transformation of Thesis Submission in India: A Case Study of NBEMS Digital Thesis Processing Portal", "Mohd Raqib Khan, Priya Vaidya & Misbah Ul Huda"),
    ("ETD2026-SUB-062", "User-Centric Evaluation of ETD Discovery: Evidence from Search Engine and Repository Usage Patterns", "Kunal Gaurav, Kunwar Singh & Arun Kumar Sharma"),
    ("ETD2026-SUB-179", "Who Owns the Thesis? Copyright, Authorship, and Academic Integrity in AI-Assisted Electronic Theses and Dissertations", "Mini Srivastava, Shefali Raizada & Shreya Chopra"),
    ("ETD2026-SUB-119", "Electronic Theses and Dissertations in the Era of Artificial Intelligence (AI): A Comparative Study of National and Global Initiatives", "Priyanka Tripathi, P.K. Jain, Deepa Singhal & Sangeeta"),
    ("ETD2026-SUB-032", "End-to-End Electronic Theses and Dissertations (ETD) Lifecycle Mapping: Challenges and opportunities in submission, curation and reuse in Indian HEIs", "Naveen Dobriyal"),
    ("ETD2026-SUB-149", "KrishiKosh and the Legacy of eGranth & KrishiPrabha: Advancing ETDs and Open Access in Agricultural Research in India", ""),
    ("ETD2026-SUB-118", "Managing ETDs in Rajshahi University Central Library: A Study of Problems and Possibilities", "M. A. M. Mominur Rahman"),
    ("ETD2026-SUB-048", "Thesis Lifecycle from Submission to Dissemination: A Case Study of the Central Library, Indian Institute of Technology Delhi", "Bingi Kranthi Kumar, Meemansha Nabiyal and Vijay Kumar"),
    ("ETD2026-SUB-121", "Attitudes and Perceptions of students towards Artificial Intelligence (AI) in the Academic Library: An exploratory Pilot Study", "Hiral Patel, Pramod Patel & Meghana Mehta"),
    ("ETD2026-SUB-167", "BE FAIR and BE CARE Full: An Evaluation of Scholarly Publishers' Policies on Research Data Sharing", "Manu T R, Neeraj Kumar Chaurasia & Nabi Hasan"),
    ("ETD2026-SUB-173", "Breaking Language Barriers in Shodhganga: Exploring AI for Multilingual Access to Indian Electronic Theses and Dissertations", "Prasanth M. P., Ashok Thomas & Vinod Kumar K. T."),
    ("ETD2026-SUB-169", "Building Archives, Not Just Repositories: Workflow Lessons from Large-Scale Digitisation for Electronic Theses and Dissertations Management", "Gopal Adak & S. Shyam Sunder Rao"),
    ("ETD2026-SUB-139", "From Metadata to Knowledge Graphs: Reimagining ETD Discovery Using Hybrid Semantic Retrieval", "Kumar Sumit, Satveer Singh Nehra & Manendra Singh"),
    ("ETD2026-SUB-144", "Information Literacy competencies of Indian researchers and Artificial Intelligence for efficient utilization of ETDs", "Kandhasamy K, Charu Sharma & Aravind R Nair"),
    ("ETD2026-SUB-174", "Reimagining Research in Next-generation ETD Systems: Intelligent Pathways to Data Discovery and Student Learning beyond PDF", "Shiva Kanaujia & Mamta Rani"),
    ("ETD2026-SUB-111", "Smart Academic Libraries and the Future of ETD Services: Integrating AI and Intelligent Research Support Systems", "Vikas & Dinesh K. Gupta"),
]


# ═══════════════════════════════════════════════════════════════
#  EXPERIENTIAL PAPERS (from Day 1 Session 2)
# ═══════════════════════════════════════════════════════════════
EXPERIENTIAL_PAPERS = [
    ("ETD2026-SUB-055", "Building a Next-Generation Institutional Repository and Research Data Management System Using InvenioRDM", "A. Muthuraj"),
    ("ETD2026-SUB-146", "Enhancing the Discoverability and Accessibility of Electronic Theses and Dissertations in the Age of AI through Wikimedia Projects", "Faiz Anjum & Aysha Parveen"),
]


# ═══════════════════════════════════════════════════════════════
#  LIGHTNING TALKS — 6 talks (Day 3, Technical Session 7)
# ═══════════════════════════════════════════════════════════════
LIGHTNING_TALKS = [
    ("ETD2026-LT-001", "Beyond the Repository: Transforming Scholarly Outputs into Research Insights at IIT Gandhinagar", "Dr. Kannan P, Librarian, IIT Gandhinagar"),
    ("ETD2026-LT-002", "Bridging ETDs and People Who Need It: How LIS Links Can Power Dissemination, Knowledge Sharing and Professional Networking", "Dr. Badan Barman, Assistant Professor, Gauhati University"),
    ("ETD2026-LT-003", "Creation of Inclusive and Accessible Digital Spaces: ETDs in the Age of AI", "Mr. Baiju Joy & S Raja"),
    ("ETD2026-LT-004", "Generative AI in Thesis Creation and Scholarly Writing", "Dr. Parveen Babbar, Deputy Librarian, JNU, New Delhi"),
    ("ETD2026-LT-005", "Navigating Regional-Language ETDs Across Digital Platforms: A Researcher's Perspective", "Dr. Santosh C. Hulagabali, University Librarian, Central University of Haryana"),
    ("ETD2026-LT-006", "Metadata for Audio-Visual Research Outputs in ETD Repositories: Interoperability, Preservation, and AI Readiness", "Dr. Sanjay Vats, Project Lead – Information Management, Vedanta Limited (Cairn Oil & Gas)"),
]


# ═══════════════════════════════════════════════════════════════
#  POSTERS — 13 posters, EXACT IDs & titles from Posters HTML
# ═══════════════════════════════════════════════════════════════
POSTERS = [
    ("ETD2026-SUB-107", "Academic Integrity and Responsible Use of AI Tools in Research: Emerging Ethical Challenges", "Dinesh K. Gupta, Renu & Sulekha"),
    ("ETD2026-SUB-064", "AI-Assisted Cross-Lingual Discovery of Non-English ETDs: A Conceptual Framework", "Adarsh Krishna R S"),
    ("ETD2026-SUB-164", "LLM-Assisted Review of Metadata Quality and Semantic Enrichment of Tuberculosis-Related ETDs: An Exploratory Study using ChatGPT and Perplexity", "Sangeeta Narang, Praveen Vashist & Charles J Greenberg"),
    ("ETD2026-SUB-178", "AI-Powered ETDs: Scopes, Prospects & Challenges", "Ankita Ghosh"),
    ("ETD2026-SUB-181", "Assessment and Evaluation of National ETD Repositories: a comparative study", "Sameena Khatoon & Madhulika Parihar"),
    ("ETD2026-SUB-034", "Development of Departmental – Level ETD and Scholarly Content Repository using Omeka Classic: A case study of the Library and Information Science Department, Central University of Himachal Pradesh", "Rishabh Kumar, Shivarama Rao & Kruti Trivedi"),
    ("ETD2026-SUB-109", "Enhancing ETDs Cataloging Workflows with AI-Generated Metadata: A Case Study Using ChatGPT and ScholarWorks", "Boutsaba Janetvilay"),
    ("ETD2026-SUB-165", "ETD Consortia: Building a Global Gateway to Scholarly Research", "Rohit Singh"),
    ("ETD2026-SUB-067", "Global Growth and Development of Electronic Theses and Dissertations (ETDs) and Repository Trends (2014–2023)", "V. Kalaiappan & V. Rajasekar"),
    ("ETD2026-SUB-078", "From Submission to Semantics: Proposing an AI-Assisted Prenatal Metadata Support System for Electronic Theses and Dissertations", "Manmeet Kaur & Kumar Rohit"),
    ("ETD2026-SUB-180", "Governing the Invisible Hand: An Ethical-Legal-Responsible AI Framework for Electronic Theses and Dissertations", "Akella N V S S R Syamala Rao & Suryanarayana Alamuri"),
    ("ETD2026-SUB-014", "Integrating Artificial Intelligence with Open Science Repositories: Opportunities, Challenges, and Strategic Frameworks", "Jatinder Kumar & Suman Sumi"),
    ("ETD2026-SUB-090", "Mapping the Global LIS Research Landscape: From Bibliometric Trends to AI-Assisted Discovery", "Rukhsar & Archana Shukla"),
]


class Command(BaseCommand):
    help = "Flushes & reseeds ETD 2026 (Days 1-3 only). Exact paper/poster IDs matched to Full Papers & Posters HTML."

    def add_arguments(self, parser):
        parser.add_argument('--rebase-start', type=str, default='2026-10-23',
            help='Date for Day 1. Use YYYY-MM-DD or "today". Default: 2026-10-23')

    def handle(self, *args, **options):
        from apps.schedule.models import ScheduleSession, ScheduleSubSession, AcceptedPaper

        raw = options['rebase_start'].strip().lower()
        day1 = date.today() if raw == 'today' else datetime.strptime(raw, '%Y-%m-%d').date()
        day2, day3 = day1 + timedelta(days=1), day1 + timedelta(days=2)
        DAY_MAP = {1: day1, 2: day2, 3: day3}

        self.stdout.write(self.style.WARNING(
            f'\n═══ ETD 2026 RESEED ═══\nDay 1: {day1}\nDay 2: {day2}\nDay 3: {day3}\n'
        ))

        with transaction.atomic():
            # ── FLUSH ──
            n_p, n_s, n_ss = AcceptedPaper.objects.count(), ScheduleSubSession.objects.count(), ScheduleSession.objects.count()
            AcceptedPaper.objects.all().delete()
            ScheduleSubSession.objects.all().delete()
            ScheduleSession.objects.all().delete()
            self.stdout.write(f'🗑  Flushed: {n_ss} sessions, {n_s} sub-sessions, {n_p} papers\n')

            # ── CREATE SESSIONS ──
            created_sessions = {}
            n_subs_created = 0
            for s in SCHEDULE:
                sess = ScheduleSession.objects.create(
                    day=s['day'], date=DAY_MAP[s['day']],
                    start_time=s['start'], end_time=s['end'],
                    title=s['title'], session_type=s['stype'],
                    room=s.get('room', ''), description=s.get('desc', ''),
                    is_featured=s.get('featured', False),
                    is_parallel=s.get('is_parallel', False),
                    is_published=True,
                    is_meal=s.get('is_meal', False),
                    meal_category=s.get('meal_category', ''),
                    display_order=s['order'],
                    feedback_enabled=s['stype'] not in ('break', 'meal', 'special'),
                    feedback_auto_open=True,
                )
                created_sessions[s['title']] = sess
                for sub_title, sub_start, sub_end, sub_speaker in s.get('subs', []):
                    ScheduleSubSession.objects.create(
                        session=sess, title=sub_title,
                        speaker_name=sub_speaker or '',
                        start_time=sub_start, end_time=sub_end,
                    )
                    n_subs_created += 1

            n_meals = sum(1 for s in SCHEDULE if s.get('is_meal'))
            self.stdout.write(f'✅ Sessions: {len(SCHEDULE)} ({n_meals} meals) · Sub-sessions: {n_subs_created}\n')

            # ── HELPER: find session by title substring ──
            def find_sess(substring):
                for title, sess in created_sessions.items():
                    if substring in title:
                        return sess
                return None

            # ── CREATE FULL PAPERS (round-robin across 9 tech sessions) ──
            tech_sessions = [
                find_sess('Technical Session 1'), find_sess('Technical Session 2'),
                find_sess('Technical Session 3'), find_sess('Technical Session 4'),
                find_sess('Technical Session 5.1'), find_sess('Technical Session 5.2'),
                find_sess('Technical Session 6.1'), find_sess('Technical Session 6.2'),
                find_sess('Technical Session 7'),
                find_sess('Technical Session 8.1'), find_sess('Technical Session 8.2'),
                find_sess('Technical Session 9'),
            ]
            tech_sessions = [s for s in tech_sessions if s is not None]

            for idx, (pid, title, authors) in enumerate(FULL_PAPERS):
                target = tech_sessions[idx % len(tech_sessions)]
                slot_min = (idx // len(tech_sessions)) * 10
                s_dt = datetime.combine(date.today(), target.start_time) + timedelta(minutes=slot_min)
                e_dt = s_dt + timedelta(minutes=10)
                AcceptedPaper.objects.create(
                    paper_id=pid, title=title, authors=authors,
                    abstract=f"Full paper submission. {('Authors: ' + authors) if authors else 'Authors to be confirmed.'}",
                    track='Full Paper', paper_type='paper',
                    session=target, slot_start=s_dt.time(), slot_end=e_dt.time(),
                    slot_order=idx + 1, is_published=True,
                )
            self.stdout.write(f'✅ Full Papers: {len(FULL_PAPERS)}\n')

            # ── CREATE EXPERIENTIAL PAPERS (Day 1 Session 2) ──
            exp_sess = find_sess('Technical Session 2')
            for idx, (pid, title, authors) in enumerate(EXPERIENTIAL_PAPERS):
                s_dt = datetime.combine(date.today(), time(16, 46)) + timedelta(minutes=idx * 10)
                e_dt = s_dt + timedelta(minutes=10)
                AcceptedPaper.objects.create(
                    paper_id=pid, title=title, authors=authors,
                    abstract=f"Experiential paper. Authors: {authors}.",
                    track='Experiential Paper', paper_type='paper',
                    session=exp_sess, slot_start=s_dt.time(), slot_end=e_dt.time(),
                    slot_order=idx + 1, is_published=True,
                )
            self.stdout.write(f'✅ Experiential Papers: {len(EXPERIENTIAL_PAPERS)}\n')

            # ── CREATE LIGHTNING TALKS (Day 3 Session 7) ──
            lt_sess = find_sess('Technical Session 7')
            for idx, (pid, title, authors) in enumerate(LIGHTNING_TALKS):
                s_dt = datetime.combine(date.today(), time(10, 6)) + timedelta(minutes=idx * 7)
                e_dt = s_dt + timedelta(minutes=7)
                AcceptedPaper.objects.create(
                    paper_id=pid, title=title, authors=authors,
                    abstract=f"Lightning Talk (7 min). Speaker: {authors}.",
                    track='Lightning Talk', paper_type='paper',
                    session=lt_sess, slot_start=s_dt.time(), slot_end=e_dt.time(),
                    slot_order=idx + 1, is_published=True,
                )
            self.stdout.write(f'✅ Lightning Talks: {len(LIGHTNING_TALKS)}\n')

            # ── CREATE POSTERS (Day 1 Session 2, 17:26-18:05, 3 min each) ──
            poster_sess = find_sess('Technical Session 2')
            for idx, (pid, title, authors) in enumerate(POSTERS):
                s_dt = datetime.combine(date.today(), time(17, 26)) + timedelta(minutes=idx * 3)
                e_dt = s_dt + timedelta(minutes=3)
                AcceptedPaper.objects.create(
                    paper_id=pid, title=title, authors=authors,
                    abstract=f"Poster. Authors: {authors}.",
                    track='Poster Presentation', paper_type='poster',
                    session=poster_sess, slot_start=s_dt.time(), slot_end=e_dt.time(),
                    slot_order=idx + 1, is_published=True,
                )
            self.stdout.write(f'✅ Posters: {len(POSTERS)}\n')

        self.stdout.write(self.style.SUCCESS(
            f'\n═══ DONE ═══\n'
            f'Sessions:            {len(SCHEDULE)} (meals flagged: {n_meals})\n'
            f'Sub-sessions:        {n_subs_created}\n'
            f'Full Papers:         {len(FULL_PAPERS)}\n'
            f'Experiential Papers: {len(EXPERIENTIAL_PAPERS)}\n'
            f'Lightning Talks:     {len(LIGHTNING_TALKS)}\n'
            f'Posters:             {len(POSTERS)}\n'
            f'TOTAL submissions:   {len(FULL_PAPERS) + len(EXPERIENTIAL_PAPERS) + len(LIGHTNING_TALKS) + len(POSTERS)}\n'
        ))
