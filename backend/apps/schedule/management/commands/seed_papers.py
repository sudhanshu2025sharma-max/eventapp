import random
from datetime import time, timedelta, datetime
from django.core.management.base import BaseCommand
from apps.schedule.models import AcceptedPaper, ScheduleSession

INSIGHT_PAPERS = [
    ("ETD2026-SUB-020", "Enhancing Interoperability in ETD Repositories Through Metadata Standards and Linked Data Technologies: A Case Study of Mangalayatan University"),
    ("ETD2026-SUB-022", "AI-Driven Digital Preservation of ETDs for Promoting Open Access in Developing Countries: A Study of University Libraries of Bangladesh"),
    ("ETD2026-SUB-023", "Enhanced Metadata Generation for Electronic Theses and Dissertations (ETDs) Using NLP and Linked Data"),
    ("ETD2026-SUB-031", "Responsible AI in ETD: Ethical, Legal, and Governance Issues in Academic Repositories"),
    ("ETD2026-SUB-032", "End-to-End Electronic Theses and Dissertations (ETD) Lifecycle Mapping: Challenges and opportunities in submission, curation and reuse in Indian HEIs"),
    ("ETD2026-SUB-037", "Research Process Management: Improving Transparency and Reuse in Modern Research"),
    ("ETD2026-SUB-042", "A Comprehensive Survey of the Landscape of Institutional Repositories in IITs"),
    ("ETD2026-SUB-048", "Thesis Lifecycle from Submission to Dissemination: A Case Study of the Central Library, Indian Institute of Technology Delhi"),
    ("ETD2026-SUB-061", "A Comparative Study on Open Access Government or Public Funded ETDs Platforms: Challenges and Future Directions"),
    ("ETD2026-SUB-062", "User-Centric Evaluation of ETD Discovery: Evidence from Search Engine and Repository Usage Patterns"),
    ("ETD2026-SUB-075", "Mapping the Intellectual Structure of Electronic Theses and Dissertations (ETD) Research: A Bibliometric Analysis"),
    ("ETD2026-SUB-079", "Smart Retrieval of Electronic Theses and Dissertations from DSpace: Implementation of an Open-Source Framework for Repositories using the Model Context Protocol"),
    ("ETD2026-SUB-081", "Transforming Research Infrastructure Through Openness and Sustainability"),
    ("ETD2026-SUB-084", "Digital Repositories for ETDs: A Case Study Using Zotero Group Libraries for Developing Academic Repositories"),
    ("ETD2026-SUB-087", "Comparative Perspectives on Global ETD Repositories, Repository Platforms and Scholarly Networks towards Intelligent Research Infrastructures"),
    ("ETD2026-SUB-088", "Transforming Electronic Thesis and Dissertation Systems through Artificial Intelligence: An AI-Enabled DSpace Framework for Academic Libraries"),
    ("ETD2026-SUB-091", "From Key Words to Semantic Discovery: An Observational Study of IR@NITR and AI Research Assistants"),
    ("ETD2026-SUB-098", "Next-Generation ETD Infrastructure through REXI: An Integrated Open-Source Framework for Scholarly Communication"),
    ("ETD2026-SUB-104", "Need and Acceptance of AI-Based Smart Search and Recommendation Systems in Electronic Theses and Dissertations (ETD) Repositories among PhD Scholars in Lucknow: An Extended Technology Model Investigation"),
    ("ETD2026-SUB-106", "ETD Recommendation System: Enriching The Scholarly Discovery in the Academic and Research Institutions of India"),
    ("ETD2026-SUB-111", "Smart Academic Libraries and the Future of ETD Services: Integrating AI and Intelligent Research Support Systems"),
    ("ETD2026-SUB-112", "ETD Beyond Storage: Integrating Citation Tracking into Shodhganga"),
    ("ETD2026-SUB-117", "Digital Transformation of Thesis Submission in India: A Case Study of NBEMS Digital Thesis Processing Portal"),
    ("ETD2026-SUB-118", "Managing ETDs in Rajshahi University Central Library: A Study of Problems and Possibilities"),
    ("ETD2026-SUB-119", "Electronic Theses and Dissertations in the Era of Artificial Intelligence (AI): A Comparative Study of National and Global Initiatives"),
    ("ETD2026-SUB-121", "An Exploratory Pilot Study on Students' Attitudes and Perceptions Toward Artificial Intelligence in the Academic Library"),
    ("ETD2026-SUB-123", "Generative AI in M.Ed. Dissertation Writing: Practices, Perceptions and Implications for Research Ethics in Education"),
    ("ETD2026-SUB-125", "Awareness and Strategic Use of Generative Artificial Intelligence (AI) in Academic Writing and Research Workflows"),
    ("ETD2026-SUB-128", "LIS Theses in the Scholarly Ecosystem: Trends, Visibility, and Citation Impact Abstract"),
    ("ETD2026-SUB-129", "Efficient Data Migration Approach for Migrating Large-Scale ETD Repository: A Case Study of Shodhganga"),
    ("ETD2026-SUB-133", "User Perception and Research Efficiency of AI-Based ETD Discovery Systems in Academic Libraries"),
    ("ETD2026-SUB-136", "Bibliometric Analysis of Ph.D. Theses in Sanskrit: A Study of the Online Directory of Central Sanskrit University (CSU)"),
    ("ETD2026-SUB-138", "AI Literacy Among PhD Scholars of tricity-Bridging the New Academic Divide in Digital Scholarship"),
    ("ETD2026-SUB-139", "From Metadata to Knowledge Graphs: Reimagining ETD Discovery Using Hybrid Semantic Retrieval"),
    ("ETD2026-SUB-141", "Ensuring Integrity in E-Theses and Dissertations Submission: The Role of Hash Values"),
    ("ETD2026-SUB-143", "A Semantic Intelligent Framework for Electronic Thesis and Dissertation (ETD) Discovery"),
    ("ETD2026-SUB-148", "Scholarly Growth and ETDs (Electronic Theses and Dissertations) Submission Patterns in Shodhganga: A Study of Central Universities in India."),
    ("ETD2026-SUB-151", "Evaluating ETD Platforms: A Comparative Study of Shodhganga and Thesis.fr"),
    ("ETD2026-SUB-158", "Mapping Artificial Intelligence Research in Kuwait: Bibliometric Insights and Implications for ETD Development"),
    ("ETD2026-SUB-169", "Building Archives, Not Just Repositories: Workflow Lessons from Large-Scale Digitisation for Electronic Theses and Dissertations Management"),
    ("ETD2026-SUB-173", "Breaking Language Barriers in Shodhganga: Exploring AI for Multilingual Access to Indian Electronic Theses and Dissertations"),
    ("ETD2026-SUB-174", "Reimagining Research in Next-generation ETD Systems: Intelligent Pathways to Data Discovery and Student Learning beyond PDF"),
    ("ETD2026-SUB-175", "Enhancing the Discoverability of Electronic Theses and Dissertations Through Artificial Intelligence and Semantic Technologies: a Review"),
    ("ETD2026-SUB-179", "Who Owns the Thesis? Copyright, Authorship, and Academic Integrity in AI-Assisted Electronic Theses and Dissertations"),
]

EXPERIENTIAL_PAPERS = [
    ("ETD2026-SUB-055", "Building a Next-Generation Institutional Repository and Research Data Management System Using InvenioRDM"),
    ("ETD2026-SUB-113", "Building ETD Visibility, Usage, and Impact with Persistent Identifiers and Open Metadata: Use Cases from Australia, Tunisia, and Côte d'Ivoire"),
    ("ETD2026-SUB-146", "Enhancing the Discoverability and Accessibility of Electronic Theses and Dissertations in the Age of AI through Wikimedia Projects"),
    ("ETD2026-SUB-152", "Countering AI Misuse, Fostering Originality: Designing an Institutional Framework for Rubrics in Doctoral Assessment through Constructive Alignment"),
]

LIGHTNING_TALKS = [
    ("ETD2026-SUB-127", "Creation of Inclusive and Accessible Digital Spaces: ETDs in the Age of AI"),
    ("ETD2026-SUB-195", "Generative AI in Thesis Creation and Scholarly Writing"),
    ("ETD2026-SUB-196", "Beyond Fact-Checking: Rethinking Information Literacy for ETDs in the Age of AI"),
    ("ETD2026-SUB-197", "Beyond Preservation: Bridging the Metadata Expertise Gap for Multilingual ETDs with AI"),
]

AUTHORS_POOL = [
    "Dr. Ramesh Sharma, Prof. Sunita Verma",
    "Amit Kumar, Priya Singh, Dr. Rajesh Gupta",
    "John Doe, Jane Smith, A. B. Patel",
    "Dr. S. K. Roy, Meena Kumari",
    "Vikram Malhotra, Ananya Sen",
]

class Command(BaseCommand):
    help = "Seeds Accepted Papers and links them to Technical Sessions"

    def handle(self, *args, **options):
        # Clear existing paper type submissions
        AcceptedPaper.objects.filter(paper_type='paper').delete()

        sessions = list(ScheduleSession.objects.filter(session_type__in=['technical', 'keynote', 'special']))
        if not sessions:
            self.stdout.write(self.style.WARNING("No technical sessions found! Creating 3 default Technical Sessions..."))
            from datetime import date
            s1 = ScheduleSession.objects.create(day=1, date=date(2026, 9, 18), start_time=time(11, 0), end_time=time(13, 0), title="Technical Session 1 - AI in Repositories", session_type="technical", room="LHC-211")
            s2 = ScheduleSession.objects.create(day=2, date=date(2026, 9, 19), start_time=time(11, 0), end_time=time(13, 0), title="Technical Session 2 - Semantic Discovery", session_type="technical", room="LHC-212")
            s3 = ScheduleSession.objects.create(day=3, date=date(2026, 9, 20), start_time=time(11, 0), end_time=time(13, 0), title="Technical Session 3 - Ethics & Governance", session_type="technical", room="Bharti Building")
            sessions = [s1, s2, s3]

        all_papers = []
        for pid, title in INSIGHT_PAPERS:
            all_papers.append((pid, title, "Insight Paper"))
        for pid, title in EXPERIENTIAL_PAPERS:
            all_papers.append((pid, title, "Experiential Paper"))
        for pid, title in LIGHTNING_TALKS:
            all_papers.append((pid, title, "Lightning Talk"))

        created_count = 0
        for i, (pid, title, track) in enumerate(all_papers):
            session = sessions[i % len(sessions)]
            
            # Calculate slot times (15 min per presentation starting from session start_time)
            slot_offset = (i // len(sessions)) * 15
            start_dt = datetime.combine(datetime.today(), session.start_time) + timedelta(minutes=slot_offset)
            end_dt = start_dt + timedelta(minutes=15)

            AcceptedPaper.objects.create(
                paper_id=pid,
                title=title,
                authors=random.choice(AUTHORS_POOL),
                abstract=f"This paper explores key concepts regarding '{title}'. It discusses implementation methodologies, challenges, and future directions in the age of AI.",
                track=track,
                paper_type='paper',
                session=session,
                slot_start=start_dt.time(),
                slot_end=end_dt.time(),
                is_published=True,
            )
            created_count += 1

        self.stdout.write(self.style.SUCCESS(f"Successfully seeded {created_count} Accepted Papers across {len(sessions)} sessions!"))
