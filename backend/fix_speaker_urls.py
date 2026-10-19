# Clean apps/speakers/urls.py
with open("apps/speakers/urls.py", "w") as f:
    f.write("""from django.urls import path
from . import views

urlpatterns = [
    path('',          views.list_speakers, name='speaker_list_api'),
    path('<int:pk>/', views.speaker_detail, name='speaker_detail_api'),
]
""")

# Add route to apps/speakers/admin_urls.py
with open("apps/speakers/admin_urls.py", "r") as f:
    admin_urls = f.read()

if "export_speaker_credentials" not in admin_urls:
    admin_urls = admin_urls.replace(
        "urlpatterns = [",
        "urlpatterns = [\n    path('speakers/export-credentials/', admin_views.export_speaker_credentials, name='speaker_export_credentials'),"
    )
    with open("apps/speakers/admin_urls.py", "w") as f:
        f.write(admin_urls)

print("✅ Fixed apps/speakers/urls.py and apps/speakers/admin_urls.py!")
