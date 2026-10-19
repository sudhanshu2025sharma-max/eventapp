import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'confhub.settings')
django.setup()

from datetime import time
from django.db import transaction
from apps.schedule.models import ScheduleSession, AcceptedPaper, FeedbackForm, FeedbackQuestion

def parse_t(val):
    if not val: return None
    h, m = map(int, val.split(':'))
    return time(h, m)

mapping = [
    # Session 1 (Day 1)
    ("ETD2026-SUB-173", "Technical Session 1:", "15:36", "15:45", 1),
    ("ETD2026-SUB-139", "Technical Session 1:", "15:46", "15:55", 2),
    ("ETD2026-SUB-174", "Technical Session 1:", "15:56", "16:05", 3),

    # Session 2 (Day 1) - Experiential & Insight
    ("ETD2026-SUB-055", "Technical Session 2:", "16:56", "17:05", 1),
    ("ETD2026-SUB-146", "Technical Session 2:", "17:06", "17:15", 2),
    ("ETD2026-SUB-032", "Technical Session 2:", "17:16", "17:25", 3),
    ("ETD2026-SUB-048", "Technical Session 2:", "17:26", "17:35", 4),

    # Session 2 (Day 1) - 13 Posters
    ("ETD2026-SUB-107", "Technical Session 2:", "17:36", "18:05", 5),
    ("ETD2026-SUB-064", "Technical Session 2:", "17:36", "18:05", 6),
    ("ETD2026-SUB-178", "Technical Session 2:", "17:36", "18:05", 7),
    ("ETD2026-SUB-181", "Technical Session 2:", "17:36", "18:05", 8),
    ("ETD2026-SUB-034", "Technical Session 2:", "17:36", "18:05", 9),
    ("ETD2026-SUB-109", "Technical Session 2:", "17:36", "18:05", 10),
    ("ETD2026-SUB-165", "Technical Session 2:", "17:36", "18:05", 11),
    ("ETD2026-SUB-078", "Technical Session 2:", "17:36", "18:05", 12),
    ("ETD2026-SUB-067", "Technical Session 2:", "17:36", "18:05", 13),
    ("ETD2026-SUB-180", "Technical Session 2:", "17:36", "18:05", 14),
    ("ETD2026-SUB-014", "Technical Session 2:", "17:36", "18:05", 15),
    ("ETD2026-SUB-164", "Technical Session 2:", "17:36", "18:05", 16),
    ("ETD2026-SUB-090", "Technical Session 2:", "17:36", "18:05", 17),

    # Session 3 (Day 2)
    ("ETD2026-SUB-087", "Technical Session 3:", "10:26", "10:35", 1),
    ("ETD2026-SUB-129", "Technical Session 3:", "10:36", "10:45", 2),
    ("ETD2026-SUB-151", "Technical Session 3:", "10:46", "10:55", 3),

    # Session 4 (Day 2)
    ("ETD2026-SUB-042", "Technical Session 4:", "12:01", "12:09", 1),
    ("ETD2026-SUB-158", "Technical Session 4:", "12:10", "12:18", 2),
    ("ETD2026-SUB-136", "Technical Session 4:", "12:19", "12:27", 3),
    ("ETD2026-SUB-112", "Technical Session 4:", "12:28", "12:36", 4),
    ("ETD2026-SUB-128", "Technical Session 4:", "12:37", "12:45", 5),

    # Session 5.1 (Day 2)
    ("ETD2026-SUB-023", "Technical Session 5.1:", "14:26", "14:37", 1),
    ("ETD2026-SUB-175", "Technical Session 5.1:", "14:38", "14:49", 2),
    ("ETD2026-SUB-091", "Technical Session 5.1:", "14:50", "15:01", 3),
    ("ETD2026-SUB-079", "Technical Session 5.1:", "15:02", "15:13", 4),
    ("ETD2026-SUB-133", "Technical Session 5.1:", "15:14", "15:25", 5),

    # Session 5.2 (Day 2)
    ("ETD2026-SUB-143", "Technical Session 5.2:", "14:26", "14:37", 1),
    ("ETD2026-SUB-028", "Technical Session 5.2:", "14:38", "14:49", 2),
    ("ETD2026-SUB-084", "Technical Session 5.2:", "14:50", "15:01", 3),
    ("ETD2026-SUB-020", "Technical Session 5.2:", "15:02", "15:13", 4),
    ("ETD2026-SUB-088", "Technical Session 5.2:", "15:14", "15:25", 5),

    # Session 6.1 (Day 2)
    ("ETD2026-SUB-152", "Technical Session 6.1:", "16:51", "17:00", 1),
    ("ETD2026-SUB-141", "Technical Session 6.1:", "17:01", "17:10", 2),
    ("ETD2026-SUB-037", "Technical Session 6.1:", "17:11", "17:20", 3),
    ("ETD2026-SUB-031", "Technical Session 6.1:", "17:21", "17:30", 4),
    ("ETD2026-SUB-062", "Technical Session 6.1:", "17:31", "17:40", 5),
    ("ETD2026-SUB-179", "Technical Session 6.1:", "17:41", "17:50", 6),

    # Session 6.2 (Day 2)
    ("ETD2026-SUB-138", "Technical Session 6.2:", "17:11", "17:20", 1),
    ("ETD2026-SUB-125", "Technical Session 6.2:", "17:21", "17:30", 2),
    ("ETD2026-SUB-117", "Technical Session 6.2:", "17:31", "17:40", 3),
    ("ETD2026-SUB-123", "Technical Session 6.2:", "17:41", "17:50", 4),

    # Session 7.1 (Day 3)
    ("ETD2026-SUB-106", "Technical Session 7.1:", "10:41", "10:50", 1),
    ("ETD2026-SUB-104", "Technical Session 7.1:", "10:51", "11:00", 2),
    ("ETD2026-LT-001", "Technical Session 7.1:", "11:01", "11:08", 3),
    ("ETD2026-LT-002", "Technical Session 7.1:", "11:09", "11:16", 4),
    ("ETD2026-LT-003", "Technical Session 7.1:", "11:17", "11:24", 5),

    # Session 7.2 (Day 3)
    ("ETD2026-SUB-061", "Technical Session 7.2:", "10:41", "10:50", 1),
    ("ETD2026-SUB-119", "Technical Session 7.2:", "10:51", "11:00", 2),
    ("ETD2026-LT-004", "Technical Session 7.2:", "11:01", "11:08", 3),
    ("ETD2026-LT-005", "Technical Session 7.2:", "11:09", "11:16", 4),
    ("ETD2026-LT-006", "Technical Session 7.2:", "11:17", "11:24", 5),

    # Session 8.1 (Day 3)
    ("ETD2026-SUB-144", "Technical Session 8.1:", "12:41", "12:47", 1),
    ("ETD2026-SUB-098", "Technical Session 8.1:", "12:48", "12:54", 2),
    ("ETD2026-SUB-118", "Technical Session 8.1:", "12:55", "13:00", 3),

    # Session 8.2 (Day 3)
    ("ETD2026-SUB-121", "Technical Session 8.2:", "12:21", "12:30", 1),
    ("ETD2026-SUB-169", "Technical Session 8.2:", "12:31", "12:40", 2),
    ("ETD2026-SUB-167", "Technical Session 8.2:", "12:41", "12:50", 3),
    ("ETD2026-SUB-111", "Technical Session 8.2:", "12:51", "13:00", 4),
]

@transaction.atomic
def run():
    # 1. LINK PAPERS EXACTLY TO SESSIONS
    print("--- LINKING PAPERS TO SESSIONS ---")
    linked = 0
    for pid, prefix, start_str, end_str, order in mapping:
        sess = ScheduleSession.objects.filter(title__startswith=prefix).first()
        if not sess:
            print(f"ERROR: No session starts with '{prefix}'")
            continue
        
        paper = AcceptedPaper.objects.filter(paper_id=pid).first()
        if paper:
            paper.session = sess
            paper.slot_start = parse_t(start_str)
            paper.slot_end = parse_t(end_str)
            paper.slot_order = order
            paper.save()
            linked += 1

    print(f"Successfully linked {linked} papers to exact presentation slots!\n")

    # 2. CONFIGURE STANDARDIZED FEEDBACK
    print("--- CONFIGURING STANDARDIZED FEEDBACK ---")
    # Disable on non-academic events entirely
    ScheduleSession.objects.all().update(feedback_enabled=False)
    core_types = ['technical', 'keynote', 'workshop', 'panel']
    ScheduleSession.objects.filter(session_type__in=core_types).update(feedback_enabled=True)

    # Wipe out any old feedback questions
    FeedbackForm.objects.all().delete()
    
    # Detect the correct model choices
    q_types = dict(FeedbackQuestion._meta.get_field('question_type').choices).keys()
    star_t = 'star' if 'star' in q_types else ('rating' if 'rating' in q_types else 'number')
    radio_t = 'radio' if 'radio' in q_types else ('single_choice' if 'single_choice' in q_types else 'choice')

    # Assign options based on whether field is JSON or string
    options_field = type(FeedbackQuestion._meta.get_field('options')).__name__
    options_val = ["Highly Relevant", "Relevant", "Neutral", "Not Relevant"] if options_field == 'JSONField' else "Highly Relevant,Relevant,Neutral,Not Relevant"

    forms_created = 0
    # Apply standard option questions to all core sessions automatically
    for sess in ScheduleSession.objects.filter(feedback_enabled=True):
        form = FeedbackForm.objects.create(session=sess, title=f"Feedback: {sess.title[:50]}...", is_active=True)
        
        # 1. Overall Rating (Star/Rating)
        FeedbackQuestion.objects.create(form=form, question_text="Overall Session Rating", question_type=star_t, is_required=True, order=1)
        
        # 2. Options (Radio)
        FeedbackQuestion.objects.create(form=form, question_text="Content Relevance", question_type=radio_t, options=options_val, is_required=True, order=2)
        
        # 3. Speaker Rating (Star/Rating)
        FeedbackQuestion.objects.create(form=form, question_text="Speaker/Presenter Rating", question_type=star_t, is_required=True, order=3)
        forms_created += 1
        
    print(f"Created standardized feedback rules for {forms_created} core sessions (No free text allowed).\n")

run()
