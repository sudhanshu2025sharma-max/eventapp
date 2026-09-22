Here is the command to instantly mark 50 random dummy participants as **interested in the Ideathon**.

Run this command on your VM:

```bash
cd /home/baadalvm/eventapp/backend
python3 manage.py shell << 'PYEOF'
import random
from apps.accounts.models import User
from apps.polls.ideathon_models import IdeathonInterest
from apps.checkins.models import CheckIn

# Select all dummy participants
users = list(User.objects.filter(email__endswith='@test.com', role='participant'))
if not users:
    users = list(User.objects.filter(role='participant'))

print(f"Total eligible participant accounts: {len(users)}")

# Pick 50 random participants
sample_size = min(50, len(users))
selected_users = random.sample(users, sample_size)

added = 0
for u in selected_users:
    # 1. Register Ideathon Interest
    _, created = IdeathonInterest.objects.get_or_create(user=u)
    if created:
        added += 1
    
    # 2. Also ensure they are checked-in so they can be invited/checked anywhere
    CheckIn.objects.get_or_create(user=u, defaults={'checkin_type': 'conference'})

print(f"✅ Successfully marked {added} new users interested ({IdeathonInterest.objects.count()} total interested in DB).")
PYEOF
```

---

### If you also want to update your seed command directly:
You can append this logic to your seed command so any fresh re-seeding automatically marks 50 participants as interested:

```bash
cat << 'EOF' > /home/baadalvm/eventapp/backend/apps/accounts/management/commands/seed_dummy_participants.py
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
import random

User = get_user_model()

MALE_NAMES = [
    ("Aarav", "Sharma"), ("Aditya", "Kumar"), ("Akash", "Singh"), ("Amit", "Verma"),
    ("Anand", "Patel"), ("Arjun", "Gupta"), ("Aryan", "Mishra"), ("Ashish", "Yadav"),
    ("Bhavesh", "Joshi"), ("Chirag", "Mehta"), ("Deep", "Shah"), ("Devraj", "Nair"),
    ("Dhruv", "Pillai"), ("Dinesh", "Rao"), ("Farhan", "Khan"), ("Gaurav", "Tiwari"),
    ("Harsh", "Pandey"), ("Himanshu", "Srivastava"), ("Ishaan", "Bose"), ("Jay", "Desai"),
    ("Karan", "Malhotra"), ("Kartik", "Agarwal"), ("Kunal", "Saxena"), ("Lokesh", "Reddy"),
    ("Manish", "Choudhary"), ("Mayank", "Tripathi"), ("Mohit", "Chauhan"), ("Mukesh", "Dubey"),
    ("Nikhil", "Banerjee"), ("Nilesh", "Jain"), ("Nitin", "Kapoor"), ("Piyush", "Bhatt"),
    ("Pranav", "Kulkarni"), ("Prashant", "Shukla"), ("Pratik", "Ghosh"), ("Rahul", "Das"),
    ("Raj", "Iyer"), ("Rajesh", "Menon"), ("Rakesh", "Chandra"), ("Rohit", "Bhardwaj"),
    ("Sachin", "Patil"), ("Sagar", "Thakur"), ("Sanjay", "Dutta"), ("Shubham", "Awasthi"),
    ("Siddharth", "Mukherjee"), ("Suresh", "Naidu"), ("Tarun", "Mathur"), ("Uday", "Rajan"),
    ("Vikram", "Sinha"), ("Vishal", "Garg"),
]

FEMALE_NAMES = [
    ("Aakanksha", "Sharma"), ("Aditi", "Gupta"), ("Akshita", "Singh"), ("Amrita", "Verma"),
    ("Ananya", "Patel"), ("Anjali", "Kumar"), ("Ankita", "Mishra"), ("Aparna", "Yadav"),
    ("Archana", "Joshi"), ("Avni", "Mehta"), ("Bhavna", "Shah"), ("Deepa", "Nair"),
    ("Divya", "Pillai"), ("Diya", "Rao"), ("Garima", "Khan"), ("Harshita", "Tiwari"),
    ("Isha", "Pandey"), ("Jyoti", "Srivastava"), ("Kajal", "Bose"), ("Kavita", "Desai"),
    ("Khushi", "Malhotra"), ("Komal", "Agarwal"), ("Kritika", "Saxena"), ("Lakshmi", "Reddy"),
    ("Mansi", "Choudhary"), ("Meera", "Tripathi"), ("Megha", "Chauhan"), ("Monika", "Dubey"),
    ("Namrata", "Banerjee"), ("Nandini", "Jain"), ("Neha", "Kapoor"), ("Nidhi", "Bhatt"),
    ("Nisha", "Kulkarni"), ("Pallavi", "Shukla"), ("Pooja", "Ghosh"), ("Prachi", "Das"),
    ("Pragya", "Iyer"), ("Priya", "Menon"), ("Priyanka", "Chandra"), ("Radha", "Bhardwaj"),
    ("Renu", "Patil"), ("Riddhi", "Thakur"), ("Ritu", "Dutta"), ("Rupal", "Awasthi"),
    ("Seema", "Mukherjee"), ("Shreya", "Naidu"), ("Simran", "Mathur"), ("Sneha", "Rajan"),
    ("Sonali", "Sinha"), ("Swati", "Garg"),
]

DESIGNATIONS = [
    "PhD Scholar", "Research Scholar", "Assistant Professor",
    "Associate Professor", "Professor", "Post-doctoral Fellow",
    "M.Tech Student", "Junior Research Fellow", "Senior Research Fellow",
]

INSTITUTES = [
    "IIT Delhi", "IIT Bombay", "IIT Madras", "IIT Kanpur", "IIT Kharagpur",
    "IISc Bangalore", "NIT Trichy", "NIT Warangal", "TIFR Mumbai",
    "IIIT Hyderabad", "Jadavpur University", "BHU Varanasi",
    "University of Delhi", "Anna University", "Pune University",
]

ALL_INTERESTS = [
    "Digital Libraries", "Metadata Standards", "Open Access",
    "Semantic Web", "Information Retrieval", "AI in Libraries",
    "Linked Data", "Knowledge Graphs", "ETD Management",
    "Scholarly Communication", "Data Curation", "Interoperability",
    "Machine Learning", "Natural Language Processing", "Research Data Management",
    "Bibliometrics", "Scientometrics", "Academic Publishing",
    "Institutional Repositories", "Copyright & Licensing",
]


def _pick_interests(index):
    start = (index * 5) % len(ALL_INTERESTS)
    picked = []
    for j in range(5):
        picked.append(ALL_INTERESTS[(start + j) % len(ALL_INTERESTS)])
    return ', '.join(picked)


class Command(BaseCommand):
    help = 'Seed 100 dummy participant accounts and mark 50 interested in Ideathon'

    def add_arguments(self, parser):
        parser.add_argument('--start', type=int, default=10,
                            help='Starting reg ID number (default: 10 → ETD-2026-R-010)')

    def handle(self, *args, **options):
        import itertools
        from apps.polls.ideathon_models import IdeathonInterest
        from apps.checkins.models import CheckIn

        start     = options['start']
        all_names = [('M', *n) for n in MALE_NAMES] + [('F', *n) for n in FEMALE_NAMES]

        male_photo   = 'profiles/placeholder-image-male.jpg'
        female_photo = 'profiles/placeholder-image-female.jpg'

        desig_cycle = itertools.cycle(DESIGNATIONS)
        inst_cycle  = itertools.cycle(INSTITUTES)

        created_users = []
        created = 0
        skipped = 0

        for i, (gender, first, last) in enumerate(all_names):
            reg_num = start + i
            reg_id  = f'ETD-2026-R-{reg_num:03d}'
            email   = f'{first.lower()}.{last.lower()}@test.com'

            user = User.objects.filter(email=email).first()
            if not user:
                user = User(
                    email              = email,
                    first_name         = first,
                    last_name          = last,
                    registration_id    = reg_id,
                    role               = 'participant',
                    gender             = 'Male' if gender == 'M' else 'Female',
                    designation        = next(desig_cycle),
                    affiliation        = next(inst_cycle),
                    research_interests = _pick_interests(i),
                    profile_photo      = male_photo if gender == 'M' else female_photo,
                    must_change_password = False,
                    is_active          = True,
                    profile_complete   = True,
                )
                user.set_password('Test@1234')
                user.save()
                created += 1
                self.stdout.write(f'  OK  {email}  {reg_id}')
            else:
                skipped += 1

            created_users.append(user)

        # Mark 50 random participants as interested in Ideathon + check them in
        sample_50 = random.sample(created_users, min(50, len(created_users)))
        for u in sample_50:
            IdeathonInterest.objects.get_or_create(user=u)
            CheckIn.objects.get_or_create(user=u, defaults={'checkin_type': 'conference'})

        self.stdout.write(self.style.SUCCESS(
            f'\nDone: {created} created, {skipped} existing. 50 participants marked as Interested in Ideathon.'
        ))
EOF
```



Revert the changes
cd /home/baadalvm/eventapp/backend
python3 manage.py shell << 'PYEOF'
from apps.polls.ideathon_models import IdeathonInterest
from apps.accounts.models import User

# Option A: Revert ONLY test dummy users (ending with @test.com)
dummy_interests = IdeathonInterest.objects.filter(user__email__endswith='@test.com')
count = dummy_interests.count()
dummy_interests.delete()
print(f"🗑️ Reverted {count} dummy test users from being interested.")

# Option B: Revert ALL interests (uncomment below if you want to wipe everything)
# IdeathonInterest.objects.all().delete()
# print("Wiped all ideathon interest entries.")
PYEOF