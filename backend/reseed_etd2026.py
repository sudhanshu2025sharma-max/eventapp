# -*- coding: utf-8 -*-
"""Reseed ETD-2026 schedule events from ETD_2026_Updated_Schedule.html.

The HTML contains no submission/paper IDs. This script therefore seeds the
schedule and event descriptions, but deliberately does not invent paper-to-
session assignments. Existing AcceptedPaper session links are cleared as in
the original reseed workflow and remain unlinked until verified IDs are supplied.
"""
import os
import django
from datetime import date, time

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "confhub.settings")
django.setup()

from django.db import transaction
from apps.schedule.models import ScheduleSession, AcceptedPaper

DAY_DATES = {
    1: date(2026, 10, 23),
    2: date(2026, 10, 24),
    3: date(2026, 10, 25),
    4: date(2026, 10, 26),
}

def parse_t(value):
    """Parse an HTML-listed HH:MM time; return None when HTML gives no time."""
    if value is None:
        return None
    h, m = map(int, value.split(":"))
    return time(h, m)

def event(day, start, end, title, session_type, room="", description="",
          display_order=1, **extra):
    return {
        "day": day,
        "date": DAY_DATES[day],
        "start_time": parse_t(start),
        "end_time": parse_t(end),
        "title": title,
        "session_type": session_type,
        "room": room,
        "description": description,
        "display_order": display_order,
        **extra,
    }

sessions_data = [
    # DAY 1 — Friday, October 23, 2026
    event(1, "07:00", "08:45", "Breakfast", "meal", "Red Square", display_order=1,
          is_meal=True, meal_category="Breakfast"),
    event(1, "08:00", "09:15", "Registration / Kit Collection", "special", display_order=2),
    event(1, None, None, "Master of the Ceremonies", "special",
          description="Charu, Ranta Das & Deepali Patel\nDais Program Coordinator: Ms. Gunjan Mishra",
          display_order=3),
    event(1, "09:15", "11:10", "Inaugural Session", "ceremony", "Seminar Hall",
          "09:15 Assembly at the Seminar Hall\n"
          "09:25–09:30 Lighting of Lamp\n"
          "09:31–09:35 Opening Remarks ETD-2026 — Dr. Nabi Hasan, Organising Chair & Head Librarian, IIT Delhi\n"
          "09:36–09:40 Welcome Address — Prof. Ramesh C Gaur, Conference Committee Chair, NDLTD, USA & Dean, Faculty of Arts and Design, South Asian University, New Delhi\n"
          "09:41–09:45 Address by Executive Director, NDLTD, USA — Prof. Edward A. Fox\n"
          "09:46–09:50 Address by IFLA President — Ms. Leslie Weir\n"
          "09:51–10:00 Address by Chief Guest — Prof. Gobardhan Das, Member, NITI Aayog, Govt. of India, New Delhi\n"
          "10:01–10:15 Address by Guest of Honour — Prof. Devika Madalli, Director, INFLIBNET Centre, Gandhinagar\n"
          "10:16–10:20 Presidential Address — Prof. Arvind K Nema, Deputy Director (Operations), IIT Delhi\n"
          "10:21–10:25 Vote of Thanks — Prof. B. J. Alappat, ACL Chairperson, IIT Delhi\n"
          "10:26–11:10 Group Photo, Inauguration of Exhibition and High Tea",
          display_order=4),
    event(1, "11:11", "12:10", "Workshop on Dryad: Publish and Preserve Your Data", "workshop",
          description="Jennifer Gibson, Executive Director, Dryad\nKailasha Purushothaman, Data Curator, Dryad",
          display_order=5),
    event(1, "12:11", "13:00",
          "Workshop on AI BHASHINI (language translation and voice-first platform, Govt. of India)",
          "workshop",
          description="Bridging divides and increasing productivity\n"
                      "Baishali Chakrabarty, Team Member, Ecosystem Enablement (Domain/Sector Engagement), BHASHINI",
          display_order=6),
    event(1, "13:01", "13:45", "Lunch Break and Visit to Exhibition Area", "meal",
          display_order=7, is_meal=True, meal_category="Lunch"),
    event(1, "13:46", "14:15", "Keynote Address - 1", "keynote",
          description="Saral AI: Democratising Scholarly Work by Transforming into Accessible, Multilingual Content\n"
                      "Prof. Ponnurangam Kumaraguru, Visiting Scientist, Anusandhan National Research Foundation (ANRF), Govt. of India",
          display_order=8, is_featured=True),
    event(1, "14:16", "16:05", "Technical Session 1: Next-Generation ETDs: AI, Infrastructure, Interoperability & Sustainable Stewardship",
          "technical", "Seminar Hall",
          "Chair: Prof. Yogendra Singh, University Librarian, SRH University, Dehradun\n"
          "Session Coordinator: Dr. Mohd Asif Khan, Indian Institute of Management, Kashipur\n"
          "14:16–14:55 INFLIBNET @ETD-2026 — An Integrated National Scholarly Ecosystem: INFLIBNET’s Services, Initiatives and Contributions to Research and ETDs — Mr. Manoj Kumar K, Scientist F-CS INFLIBNET & Centre Team, Gandhinagar, India\n"
          "14:56–15:35 Invited Talks: One Nation One Subscription (ONOS): A Strategic Imperative — Dr. Hafsa Ahmad; Next Generation ETDs: Considerations of Metadata, Interoperability, Institutional Repositories and the Global Ecosystem - With a Case Study from ISI Kolkata — Dr. Kishor Satpathy\n"
          "15:36–16:05 Insight Papers: Breaking Language Barriers in Shodhganga — Prasanth M. P., Ashok Thomas & Vinod Kumar K. T.; From Metadata to Knowledge Graphs — Kumar Sumit, Satveer Singh Nehra & Manendra Singh; Reimagining Research in Next-generation ETD Systems — Shiva Kanaujia & Mamta Rani",
          display_order=9),
    event(1, "16:06", "16:25", "Tea Break and Visit to Exhibition Area", "break", display_order=10),
    event(1, "16:26", "18:05", "Technical Session 2: Transforming the ETD Lifecycle: Workflows, AI-Enabled Management, Curation & Reuse",
          "technical", "Seminar Hall",
          "Chair: Ms. Kiran Chauhan, Director, DESIDOC, Delhi\nSession Coordinator: Dr. Ranjit Kumar Das, IIT Bombay\n"
          "16:26–16:55 Fireside Chat — Invited Guest Speaker: Prof. Parag Singla, CSE & Yardi School of AI, IIT Delhi; Host: Dr. Sangeeta Kaul, Director, DELNET, New Delhi\n"
          "16:56–17:15 Experiential Papers (10 minutes each): Building a Next-Generation Institutional Repository and Research Data Management System Using InvenioRDM — A. Muthuraj; Enhancing the Discoverability and Accessibility of Electronic Theses and Dissertations in the Age of AI through Wikimedia Projects — Faiz Anjum & Aysha Parveen\n"
          "17:16–17:35 Insight Papers: End-to-End ETD Lifecycle Mapping — Naveen Dobriyal; Thesis Lifecycle from Submission to Dissemination — Bingi Kranthi Kumar, Meemansha Nabiyal and Vijay Kumar\n"
          "17:36–18:05 Poster Presentations (2 minutes each). Moderator: Dr. Satish Malik & Prof. Nirmal Kumar Swain. Posters: Academic Integrity and Responsible Use of AI Tools in Research; AI-Assisted Cross-Lingual Discovery of Non-English ETDs; AI-Powered ETDs; Assessment and Evaluation of National ETD Repositories; Departmental-Level ETD Repository using Omeka Classic; Enhancing ETDs Cataloging Workflows with AI-Generated Metadata; ETD Consortia; From Submission to Semantics; Global Growth and Development of ETDs; Governing the Invisible Hand; Integrating AI with Open Science Repositories; LLM-Assisted Review of Metadata Quality; Mapping the Global LIS Research Landscape.",
          display_order=11),
    event(1, "18:06", "18:30", "Guided Central Library Tour & Visit to Poster Area / Exhibition / Tea", "break",
          display_order=12),
    event(1, "18:31", "20:00", "Cultural Programme", "cultural", "Seminar Hall", display_order=13),
    event(1, "20:01", None, "Dinner", "meal", display_order=14, is_meal=True, meal_category="Dinner"),

    # DAY 2 — Saturday, October 24, 2026
    event(2, "09:15", "09:45", "Keynote Address - 2", "keynote",
          description="The Next Evolution of ETDs: Reimagining Academic Knowledge in the Age of Generative AI\n"
                      "Mr. Kanwaljeet Singh Arora, AI & Blockchain Consultant and Trainer, Gurugram, Haryana",
          display_order=1, is_featured=True),
    event(2, "09:45", "11:10", "Technical Session 3: Advancing ETD Repositories: AI-Enabled Discovery, and Digital Resilience",
          "technical", description="09:46–10:25 Invited Talks: AI-enabled National Research Discovery Platform — Prof. A.R.D. Prasad; Preservation with Resilience: Strategic Disaster Recovery Planning for Institutional Repositories — Dr. Saiful Amin\n"
          "10:26–10:55 Insight Papers: Comparative Perspectives on Global ETD Repositories — Nisha S., Balasubramani R., Kanagadurgadevi S. & Annu; Efficient Data Migration Approach for Migrating Large-Scale ETD Repository — Manoj Kumar K, Vikas Pal, Rajan Kumar & Surbhi; Evaluating ETD Platforms: A Comparative Study of Shodhganga and Thesis.fr — Ufaira Yaseen & Fayaz Ahmad Loan\n"
          "10:56–11:10 Industry Presentation: Clarivate",
          display_order=2),
    event(2, "09:31", "13:00", "Ideathon (Live Collaborative Library Innovation Challenge)", "ideathon",
          "Board Room, 1st Floor, IIT Delhi", is_parallel=True, display_order=3),
    event(2, "11:11", "11:20", "Tea Break and Visit to Exhibition Area", "break", display_order=4),
    event(2, "11:21", "13:00", "Technical Session 4: ETD Analytics & Research Impact: Visibility, Metrics & Emerging Trends",
          "technical", description="Chair: Dr. Rajesh Singh, University Librarian and Head, DULS, University of Delhi\n"
          "Session Coordinator: Dr. Kumar Sanjay, Director, Library, NITI Aayog\n"
          "11:21–12:00 Invited Talks: Building ETD Visibility, Usage, and Impact with Persistent Identifiers and Open Metadata — Mohamad Mostafa; Making India's Research Count — Arend Kuester, Springer Nature\n"
          "12:01–12:45 Insight Papers: A Comprehensive Survey of Institutional Repositories in IITs — Vijay Kumar, Bingi Kranthi Kumar & Nizam Husain; Artificial Intelligence Research and ETD Readiness in Kuwait — Parvez Ahmad & Wadhhah A. Ahmed; Bibliometric Analysis of Ph.D. Theses in Sanskrit — P. M. Gupta; ETD Beyond Storage — Syed Shaz Husain & Nishat Fatima; LIS Theses in the Scholarly Ecosystem — Aasif Ahmad Mir & Fayaz Ahmad Loan\n"
          "12:46–13:00 Industry Presentations (8 minutes each): DrillBit Softtech India Pvt Ltd; VIR Softech Pvt Ltd",
          display_order=5),
    event(2, "13:01", "13:45", "Lunch Break and Visit to Exhibition Area", "meal",
          display_order=6, is_meal=True, meal_category="Lunch"),
    event(2, "13:46", "15:45", "Technical Session 5.1: AI-Driven ETD Discovery: Metadata, Semantics & Intelligent Access",
          "technical", "Seminar Hall",
          "Chair: Dr. Sili Rout, Deputy Director (Research), ICSSR\nSession Coordinator: Dr. Asif Fareed Siddiqui, Deputy Librarian, AMU, Aligarh\n"
          "13:46–14:25 Invited Talks: Beyond Preservation — Dr. Kshema Prakash; From Repository to Intelligence — Dr. Tamal Kumar Guha\n"
          "14:26–15:25 Insight Papers: Enhanced Metadata Generation for ETDs Using NLP and Linked Data — Sanjay; Enhancing Discoverability of ETDs through AI and Semantic Technologies — Partha Chattopadhyay & Arun Kumar Chakraborty; From Key Words to Semantic Discovery — Dibya Kishor Pradhan; Smart Retrieval of ETDs from DSpace using the Model Context Protocol — Tirtharaj Dasgupta, Jhantu Mazumder & Parthasarathi Mukhopadhyay; User Perception and Research Efficiency of AI-Based ETD Discovery Systems — RK Kishore Patnala, Jitendra Kumar Jain & Surendra Kumar Sahu\n"
          "15:26–15:45 Industry Presentations: ExpertEdge - by Packt; DELNET",
          is_parallel=True, display_order=7),
    event(2, "13:46", "15:45", "Technical Session 5.2: AI-Driven ETD Discovery: Metadata, Semantics & Intelligent Access",
          "technical", "Senate Room, 1st Floor",
          "Chair: Prof. Sewa Singh, Ex. Guru Nanak Dev University, Amritsar\nSession Coordinator: Dr. Faizul Nisha, DRDO\n"
          "13:46–14:25 Invited Talks: From Scan to Oblivion? — Dr. Jean-Charles LAMIREL; Transforming ETD Management — Dr. Manju Naika\n"
          "14:26–15:25 Insight Papers: A Semantic Intelligent Framework for ETD Discovery — Chitra Ghosh, Sanya Agarwal & Ankit Gupta; An Explainable Semantic Discovery Framework — Mrigank Jaiswal, Sparsh Kumar & Shivam Yadav; Digital Repositories for ETDs using Zotero Group Libraries — Goutham N. & K. G. Sudhier; Enhanced Interoperability in ETD Repositories — Shukal Kumar & Anand Prakash Srivastava; Transforming ETD Systems through AI: An AI-Enabled DSpace Framework — Keerthna M, R. Balasubramani, Susan Babu, & Annu\n"
          "15:26–15:45 Industry Presentations: IEEE; IGIN Knowledge Services Pvt. Ltd. (iGroup)",
          is_parallel=True, display_order=8),
    event(2, "15:46", "16:10", "Tea Break and Visit to Exhibition Area", "break", display_order=9),
    event(2, "16:11", "18:10", "Technical Session 6.1: Responsible AI in ETDs: Ethics, Integrity, Policy Standards, Copyright & Governance",
          "technical", "Seminar Hall",
          "Chair: Dr. Nishat Fatima, Librarian and Professor, Aligarh Muslim University\nSession Coordinator: Mr. Sudhanshu Bhushan, Scientist-F, DESIDOC\n"
          "16:11–16:50 Invited Talks: AI-Generated Hallucinated Citations — Dr. Sangeeta Kaul; Data Visitation and Federated Learning — Dr. Usha Mujoo Munshi\n"
          "16:51–17:50 Insight Papers (6): Countering AI Misuse — L S Venkatesh; Ensuring Integrity in E-Theses Submission — Prashanta Kumar Behera, Sanmati Jinendran Jain & Ramakant; Research Process Management — Snehasish Paul; Responsible AI in ETD: Ethical, Legal, and Governance Issues in Academic Repositories — Vaishnavi Ambade; User-Centric Evaluation of ETD Discovery — Kunal Gaurav, Kunwar Singh & Arun Kumar Sharma; Who Owns the Thesis? — Mini Srivastava, Shefali Raizada & Shreya Chopra\n"
          "17:51–18:10 Industry Presentations: BSB EDGE Pvt. Ltd.; Total Library Solutions (India) Pvt Ltd",
          is_parallel=True, display_order=10),
    event(2, "16:11", "18:10", "Technical Session 6.2: AI in ETD Creation: Writing, Literature Review, & Submission",
          "technical", "Senate Room, 1st Floor",
          "Chair: Dr. P.K. Jain, Former Librarian, Institute of Economic Growth, New Delhi\nSession Coordinator: Mr. Yogesh Modi, Scientist-F, DESIDOC, Delhi\n"
          "16:11–17:10 Invited Talks: Scholarly Gateway for Indian Foreign Policy Theses — Dr. Ramesh Yernagula; Shodhganga — Dr. Jagdish Arora; One Institution, One Journal — Dr. Sandeep Kumar Pathak\n"
          "17:11–17:50 Insight Papers (4): AI Literacy Among PhD Scholars — Neha Sethi & Jivesh Bansal; Awareness and Strategic Use of Generative AI — Vijay Kumar Verma et al.; Digital Transformation of Thesis Submission — Mohd Raqib Khan, Priya Vaidya & Misbah Ul Huda; Generative AI in M.Ed. Dissertation Writing — Shivani\n"
          "17:51–18:10 Industry Presentations: KGL Accucoms; World Scientific Publishing Co Pte Ltd (Video)",
          is_parallel=True, display_order=11),
    event(2, "17:00", "18:00", "IITs Library Professionals Meet", "special",
          "Learning Commons, Central Library, IIT Delhi", is_parallel=True, display_order=12),
    event(2, "18:11", "18:30", "Guided Central Library Tour & Visit to Poster Area / Exhibition / Tea", "break", display_order=13),
    event(2, "18:31", "20:00", "Cultural Programme", "cultural", "Seminar Hall", display_order=14),
    event(2, "20:01", "21:00", "Gala Dinner", "meal", display_order=15, is_meal=True, meal_category="Dinner"),

    # DAY 3 — Sunday, October 25, 2026
    event(3, "09:15", "09:45", "Keynote Address - 3", "keynote",
          description="Show Your Working: ETDs and the Evidence of Thinking\n"
                      "Shameem Nilofar Maideen, University Librarian, Singapore Management University, Singapore",
          display_order=1, is_featured=True),
    event(3, "09:46", "10:15", "Keynote Address - 4", "keynote",
          description="How Can the Internet Archive Help? Preserving the Open Thesis Record, by Libraries, for Libraries\n"
                      "Mr. Julien Masanes, Co-founder, Internet Archive Europe",
          display_order=2, is_featured=True),
    event(3, "10:16", "10:20", "Parallel Sessions Interval", "break", display_order=3),
    event(3, "10:21", "11:25", "Technical Session 7.1: Dynamic ETDs: Recommendation Systems & Immersive Scholarship",
          "technical", "Seminar Hall",
          "Chair: Dr. Mahendra N. Jadhav, Former Librarian, IIT Madras\nSession Coordinator: Dr. Samar Iqbal Bakhshi, Deputy Librarian, National Law University Delhi\n"
          "10:21–10:40 Invited Talk: The Post-Boolean Librarian: Semantic Search for ETDs through Tool RAG and Richer Metadata — Prof. Parthasarathi Mukhopadhyay\n"
          "10:41–11:00 Insight Papers: ETD Recommendation System — Srijan Dey & Parikshit Mondal; Need and Acceptance of AI-Based Smart Search and Recommendation Systems — Deepali Patel & Pravish Prakash\n"
          "11:01–11:25 Lightning Talks (7 minutes each), Moderator: Prof. Sanjay Kataria. Beyond the Repository — Dr. Kannan P; Bridging ETDs and People Who Need It — Dr. Badan Barman; Creation of Inclusive and Accessible Digital Spaces — Mr. Baiju Joy & S Raja; The National Library in the Age of AI — Prof. Arun Kumar Chakraborty",
          is_parallel=True, display_order=4),
    event(3, "10:21", "11:25", "Technical Session 7.2: Global ETD Ecosystems: Consortia, Networks, Platforms & Institutional Practices",
          "technical", "Senate Room, 1st Floor",
          "Chair: Prof. Naushad Ali, Professor of Library & Information Science, Aligarh Muslim University\nSession Coordinator: Dr. K. G. Sudhier, Assistant Professor, Central University of Tamil Nadu\n"
          "10:21–10:40 Invited Talk: Beyond Plagiarism: The Coming Crisis of Epistemic Authenticity in Graduate Research — Dr. Wasim Arif\n"
          "10:41–11:00 Insight Papers: A Comparative Study on Open Access Government or Public Funded ETDs Platforms — Inapanuri Abhinay et al.; Electronic Theses and Dissertations in the era of AI — Priyanka Tripathi, P.K. Jain, Deepa Singhal & Sangeeta\n"
          "11:01–11:25 Lightning Talks (7 minutes each), Moderator: Dr. Vijay Kumar Verma. Generative AI in Thesis Creation — Dr. Parveen Babbar; Navigating Regional-Language ETDs — Dr. Santosh C. Hulagabali; Metadata for Audio-Visual Research Outputs — Dr. Sanjay Vats",
          is_parallel=True, display_order=5),
    event(3, "11:26", "11:40", "Tea Break and Visit to Exhibition Area", "break", display_order=6),
    event(3, "11:40", "13:15", "Technical Session 8.1: The Future of ETDs: AI, Open Science & Global Access",
          "technical", "Seminar Hall",
          "Chair: Dr. Pardeep Rai, President, Indian Library Association\nSession Coordinator: Dr. Navin Upadhyay, Deputy Librarian, IIT (BHU) Varanasi\n"
          "11:40–12:40 Invited Talks: Beyond the PDF — Prof. Arjun Ghosh; Building a Digital Scholarly System — Dr. Dinesh K. S.\n"
          "12:41–13:00 Insight Papers: Information Literacy competencies of Indian researchers — Kandhasamy K, Charu Sharma & Aravind R Nair; Next-Generation ETD Infrastructure through REXI — Udayan Ghosh et al.; Managing ETDs in Rajshahi University Central Library — Mohammad Habibul Islam & M. A. M. Mominur Rahman\n"
          "13:01–13:15 Industry Presentations: Sage; Turnitin; Cambridge University Press",
          is_parallel=True, display_order=7),
    event(3, "11:40", "13:15", "Technical Session 8.2: The Future of ETDs: AI, Open Science & Global Access",
          "technical", "Senate Room, 1st Floor",
          "Chair: Dr. R.K. Sharma, Ex DG, Delhi Public Library\nSession Coordinator: Dr. Akhtar Hussain, Head, Library, IMT Ghaziabad\n"
          "11:40–12:20 Invited Talks: From Manuscript Digitisation to Knowledge Extraction — Dr. Akhtar Parvez; Open Metadata and Open Knowledge: Towards a National Policy — Dr. Nihar K. Patra\n"
          "12:21–13:00 Insight Papers: Attitudes and Perceptions of students towards AI in the Academic Library — Hiral Patel, Pramod Patel & Meghana Mehta; Building Archives, Not Just Repositories — Gopal Adak & S. Shyam Sunder Rao; BE FAIR and BE CARE Full — Manu T. R., Neeraj Kumar Chaurasia & Nabi Hasan; Smart Academic Libraries and the Future of ETD Services — Vikas & Dinesh K. Gupta\n"
          "13:01–13:15 Industry Presentations: De Gruyter Brill; Statista India Private Limited; Taylor & Francis Group",
          is_parallel=True, display_order=8),
    event(3, "13:15", "14:00", "Lunch Break and Visit to Exhibition Area", "meal",
          display_order=9, is_meal=True, meal_category="Lunch"),
    event(3, "14:01", "14:25", "Ideathon Presentations (Live Collaborative Library Innovation Challenge)", "ideathon",
          "Seminar Hall", "Presentations (5 minutes each team)\nModerators: Pankaj Chaurasia, ALIO, Prime Minister’s Museum & Library, New Delhi & Dr. Mallikarjuna C., Deputy Librarian, IIT Hyderabad",
          display_order=10),
    event(3, "14:26", "15:25", "Panel Discussion: The Next Frontier of AI: Can We Build Ethical, Secure and Interoperable ETD Practices?",
          "panel", "Seminar Hall",
          "Moderator: Dr. G. Mahesh, CSIR, Govt. of India, New Delhi, India\n"
          "Panellists: Dr. Umeshareddy Kacherki, Librarian & Head, IISc Bengaluru; Ms. Heather Greer Klein, Community Manager, Samvera Foundation, USA; Prof. Supreet Singh Bahga, Associate Dean - Academics, IIT Delhi; Prof. M. Madhan, Director, Global Library & Professor, O.P. Jindal University, Haryana, India; Mr. Arend Kuester, Country Manager India, Springer Nature",
          display_order=11),
    event(3, "15:26", "17:00", "Concluding Session", "ceremony", "Seminar Hall",
          "15:26–15:30 Gather at the Seminar Hall\n15:31–15:35 Welcome Address — Dr. Shankar Chavan\n"
          "15:36–15:45 Conference Report — Dr. Kshema Prakash\n15:46–15:55 Felicitation: Address by Guest of Honour — Prof. Sri Harsha Kota\n"
          "15:56–16:05 Awards Ceremony, coordinated by Prof. Ramesh C Gaur; ETD Leadership Award; Best Insight Paper; Best Experiential Paper; Best Lightning Talk; Best Poster; Best Innovation (Ideathon)\n"
          "16:06–16:15 Address by Guest of Honour — Prof. Uma Kanjilal\n16:16–16:25 Address by Guest of Honour — Mr. Julien Masanes\n"
          "16:25–16:40 Address by Chief Guest — Prof. Dhananjay Singh\n16:41–16:50 Presidential Address — Prof. Ashwini Agrawal\n"
          "16:51–17:00 Vote of Thanks — Dr. Neeraj Chaurasia",
          display_order=12),
    event(3, "17:00", None, "High Tea and Certificate Distribution", "meal",
          display_order=13, is_meal=True, meal_category="Tea/Coffee"),

    # DAY 4 — Monday, October 26, 2026
    event(4, None, None, "Agra Trip to the Taj Mahal", "special",
          description="Day trip; contributory. The HTML does not specify start/end times or departure venue.",
          display_order=1),
]

@transaction.atomic
def run_seed():
    # Fail before clearing anything if the model cannot represent the untimed
    # HTML events (Master of Ceremonies, 'onwards' events, and Agra day trip).
    untimed = any(x["start_time"] is None or x["end_time"] is None for x in sessions_data)
    if untimed:
        for field_name in ("start_time", "end_time"):
            if not ScheduleSession._meta.get_field(field_name).null:
                raise RuntimeError(
                    f"ScheduleSession.{field_name} must allow NULL to represent events whose HTML time is unspecified. "
                    "No database rows were changed."
                )

    print("Unlinking existing AcceptedPaper schedule assignments...")
    AcceptedPaper.objects.update(session=None, slot_start=None, slot_end=None)

    print("Replacing existing ScheduleSession rows...")
    ScheduleSession.objects.all().delete()

    created = [ScheduleSession.objects.create(**data) for data in sessions_data]
    print(f"Created {len(created)} ScheduleSession rows from the HTML schedule.")
    print("Paper mappings were not created: the HTML contains no AcceptedPaper IDs.")
    print(f"AcceptedPaper records currently unlinked: {AcceptedPaper.objects.filter(session__isnull=True).count()}")

if __name__ == "__main__":
    run_seed()
