import random
from datetime import time, timedelta, datetime
from django.core.management.base import BaseCommand
from apps.schedule.models import AcceptedPaper, ScheduleSession

POSTERS = [
    ("ETD2026-SUB-014", "Integrating Artificial Intelligence with Open Science Repositories: Opportunities, Challenges, and Strategic Frameworks"),
    ("ETD2026-SUB-034", "Development of Departmental – Level ETD and Scholarly Content Repository using Omeka Classic: A case study of the Library and Information Science Department, Central University of Himachal Pradesh"),
    ("ETD2026-SUB-090", "Mapping the Global LIS Research Landscape: From Bibliometric Trends to AI-Assisted Discovery"),
    ("ETD2026-SUB-107", "Academic Integrity and Responsible Use of AI Tools in Research: Emerging Ethical Challenges"),
    ("ETD2026-SUB-109", "Enhancing ETDs Cataloging Workflows with AI-Generated Metadata: A Case Study Using ChatGPT and ScholarWorks"),
    ("ETD2026-SUB-132", "Transforming Electronic Theses and Dissertations (ETDs) and Open Science through advanced digital technologies: Emerging Roles of Librarians, Technologists, and Institutions"),
    ("ETD2026-SUB-164", "AI-Assisted Metadata Quality Assessment of Tuberculosis-Related ETDs: A Comparative Study of Large Language Models"),
    ("ETD2026-SUB-165", "ETD Consortia: Building a Global Gateway to Scholarly Research"),
    ("ETD2026-SUB-166", "AI Governance and Research Integrity: Building Trustworthy Academic Ecosystems in South Asia"),
    ("ETD2026-SUB-180", "Governing the Invisible Hand: An Ethical-Legal-Responsible AI Framework for Electronic Theses and Dissertations"),
]

AUTHORS_POOL = [
    "Pooja Mehta, Dr. R. K. Singh",
    "Suresh Babu, Anita Sharma",
    "Dr. Marcus Vance, L. K. Rao",
    "Neha Agarwal, Rajiv Menon",
]

class Command(BaseCommand):
    help = "Seeds Accepted Posters and links them to sessions"

    def handle(self, *args, **options):
        # Clear existing poster type submissions
        AcceptedPaper.objects.filter(paper_type='poster').delete()

        sessions = list(ScheduleSession.objects.all())
        created_count = 0

        for i, (pid, title) in enumerate(POSTERS):
            session = sessions[i % len(sessions)] if sessions else None
            
            slot_offset = (i // len(sessions) if sessions else 0) * 10
            start_dt = datetime.combine(datetime.today(), session.start_time if session else time(14, 0)) + timedelta(minutes=slot_offset)
            end_dt = start_dt + timedelta(minutes=10)

            AcceptedPaper.objects.create(
                paper_id=pid,
                title=title,
                authors=random.choice(AUTHORS_POOL),
                abstract=f"Poster presentation on '{title}'. Showcasing methodologies, experimental results, and key findings.",
                track="Poster Presentation",
                paper_type='poster',
                session=session,
                slot_start=start_dt.time(),
                slot_end=end_dt.time(),
                is_published=True,
            )
            created_count += 1

        self.stdout.write(self.style.SUCCESS(f"Successfully seeded {created_count} Accepted Posters!"))
