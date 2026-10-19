import os, django
from datetime import time

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'confhub.settings')
django.setup()

from django.db import transaction
from apps.schedule.models import ScheduleSession, ScheduleSubSession
from apps.speakers.models import Speaker, SpeakerTalk

def parse_t(val):
    if not val: return None
    h, m = map(int, val.split(':'))
    return time(h, m)

subsession_data = [
    # --- Technical Session 1 ---
    ("Technical Session 1:", "14:16", "14:55", "INFLIBNET @ETD-2026 — An Integrated National Scholarly Ecosystem", "Mr. Manoj Kumar K, Scientist F-CS INFLIBNET & Centre Team, Gandhinagar"),
    ("Technical Session 1:", "14:56", "15:15", "One Nation One Subscription (ONOS): A Strategic Imperative", "Dr. Hafsa Ahmad, Scientist D, Office of the Principal Scientific Adviser"),
    ("Technical Session 1:", "15:16", "15:35", "Next Generation ETDs: Considerations of Metadata, Interoperability, Institutional Repositories and the Global Ecosystem", "Dr. Kishor Satpathy, Chief Librarian, ISI Kolkata"),

    # --- Technical Session 2 ---
    ("Technical Session 2:", "16:26", "16:55", "Fireside Chat: AI in ETD Management and Scholarly Workflows", "Prof. Parag Singla (IIT Delhi) & Dr. Sangeeta Kaul (DELNET)"),

    # --- Technical Session 3 ---
    ("Technical Session 3:", "09:46", "10:05", "AI-enabled National Research Discovery Platform", "Prof. A.R.D. Prasad, Former Professor, DRTC (ISI), Bangalore"),
    ("Technical Session 3:", "10:06", "10:25", "Preservation with Resilience: Strategic Disaster Recovery Planning for Institutional Repositories", "Dr. Saiful Amin, Director, Semantic Consulting Services"),

    # --- Technical Session 4 ---
    ("Technical Session 4:", "11:21", "11:40", "Building ETD Visibility, Usage, and Impact with Persistent Identifiers and Open Metadata", "Mohamad Mostafa, Community Specialist, DataCite"),
    ("Technical Session 4:", "11:41", "12:00", "Making India's Research Count", "Arend Kuester, Country Manager India, Springer Nature"),

    # --- Technical Session 5.1 ---
    ("Technical Session 5.1:", "13:46", "14:05", "Beyond Preservation: AI and Knowledge Curation", "Dr. Kshema Prakash, Librarian, EFLU"),
    ("Technical Session 5.1:", "14:06", "14:25", "From Repository to Intelligence", "Dr. Tamal Kumar Guha, Librarian, IIT Guwahati"),

    # --- Technical Session 5.2 ---
    ("Technical Session 5.2:", "13:46", "14:05", "From Scan to Oblivion? Agentic AI and Thesis Digitisation", "Dr. Jean-Charles LAMIREL, Associate Professor, University of Strasbourg"),
    ("Technical Session 5.2:", "14:06", "14:25", "Transforming ETD Management: Best Practices & Metadata Standards", "Dr. Manju Naika, Chief Library Officer, IIT Bombay"),

    # --- Technical Session 6.1 ---
    ("Technical Session 6.1:", "16:11", "16:30", "AI-Generated Hallucinated Citations in Scholarly Literature", "Dr. Sangeeta Kaul, Director, DELNET"),
    ("Technical Session 6.1:", "16:31", "16:50", "Data Visitation and Federated Learning for ETD Repositories", "Dr. Usha Mujoo Munshi, Chief Librarian, IIC"),

    # --- Technical Session 6.2 ---
    ("Technical Session 6.2:", "16:11", "16:30", "Scholarly Gateway for Indian Foreign Policy Theses", "Dr. Ramesh Yernagula, Director, MEA"),
    ("Technical Session 6.2:", "16:31", "16:50", "Shodhganga: National ETD Repository Advances", "Dr. Jagdish Arora, Ex Director, INFLIBNET"),
    ("Technical Session 6.2:", "16:51", "17:10", "One Institution, One Journal Initiative", "Dr. Sandeep Kumar Pathak, Librarian, IISER Bhopal"),

    # --- Technical Session 7.1 ---
    ("Technical Session 7.1:", "10:21", "10:40", "The Post-Boolean Librarian: Semantic Search for ETDs through Tool RAG and Richer Metadata", "Prof. Parthasarathi Mukhopadhyay, University of Kalyani"),

    # --- Technical Session 7.2 ---
    ("Technical Session 7.2:", "10:21", "10:40", "Beyond Plagiarism: Epistemic Authenticity in Graduate Research", "Dr. Wasim Arif, Associate Professor, NIT Silchar"),

    # --- Technical Session 8.1 ---
    ("Technical Session 8.1:", "11:40", "12:10", "Beyond the PDF: Interactive and Dynamic Theses", "Prof. Arjun Ghosh, Professor, IIT Delhi"),
    ("Technical Session 8.1:", "12:11", "12:40", "Building a Digital Scholarly System for Institutional Knowledge", "Dr. Dinesh K. S., Librarian & Registrar, IIT Ropar"),

    # --- Technical Session 8.2 ---
    ("Technical Session 8.2:", "11:40", "12:00", "From Manuscript Digitisation to Knowledge Extraction", "Dr. Akhtar Parvez, University Librarian, Jamia Hamdard"),
    ("Technical Session 8.2:", "12:01", "12:20", "Open Metadata and Open Knowledge: Towards a National Policy", "Dr. Nihar K. Patra, Librarian, IIT Roorkee"),
]

@transaction.atomic
def run():
    print("Clearing existing ScheduleSubSession entries...")
    ScheduleSubSession.objects.all().delete()

    created_count = 0
    for sess_prefix, start_str, end_str, title, speaker in subsession_data:
        sess = ScheduleSession.objects.filter(title__startswith=sess_prefix).first()
        if not sess:
            print(f"Warning: Session with prefix '{sess_prefix}' not found!")
            continue

        ScheduleSubSession.objects.create(
            session=sess,
            title=title,
            speaker_name=speaker,
            start_time=parse_t(start_str),
            end_time=parse_t(end_str)
        )
        created_count += 1

    print(f"Successfully created {created_count} invited speaker sub-sessions!")

if __name__ == "__main__":
    run()
