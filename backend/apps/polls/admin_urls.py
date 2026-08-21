from django.urls import path
from . import admin_views, ideathon_admin_views

urlpatterns = [
    path('polls/',                    admin_views.polls_panel,  name='polls_panel'),
    path('polls/create/',             admin_views.poll_create,  name='polls_create'),
    path('polls/<uuid:pk>/edit/',     admin_views.poll_edit,    name='polls_edit'),
    path('polls/<uuid:pk>/delete/',   admin_views.poll_delete,  name='polls_delete'),
    path('polls/<uuid:pk>/start/',    admin_views.poll_start,   name='polls_start'),
    path('polls/<uuid:pk>/close/',    admin_views.poll_close,   name='polls_close'),
    path('polls/<uuid:pk>/reopen/',   admin_views.poll_reopen,  name='polls_reopen'),
    path('polls/<uuid:pk>/results/',  admin_views.poll_results, name='polls_results'),
    path('polls/<uuid:pk>/export/',   admin_views.poll_export,  name='polls_export'),
    path('ideathon/',                   ideathon_admin_views.ideathon_panel, name='ideathon_panel'),
]
