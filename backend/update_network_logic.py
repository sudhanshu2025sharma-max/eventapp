import os
import django
from django.db.models import Q

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'confhub.settings')
django.setup()

from apps.accounts.models import User

def patch_network_view():
    file_path = '/home/baadalvm/eventapp/backend/apps/checkins/views.py'
    with open(file_path, 'r') as f:
        lines = f.readlines()

    new_lines = []
    skip = False
    for line in lines:
        if "queryset = User.objects.filter(is_active=True).exclude(id=request.user.id)" in line:
            # Inject the complex filter
            new_lines.append("    # Filter logic: Participants must be checked in, others all\n")
            new_lines.append("    queryset = User.objects.filter(\n")
            new_lines.append("        is_active=True\n")
            new_lines.append("    ).exclude(id=request.user.id).filter(\n")
            new_lines.append("        Q(role__in=['speaker', 'staff', 'admin']) | \n")
            new_lines.append("        Q(role='participant', is_checked_in=True)\n")
            new_lines.append("    )\n")
            continue
        new_lines.append(line)

    with open(file_path, 'w') as f:
        f.writelines(new_lines)

if __name__ == "__main__":
    patch_network_view()
