from django.urls import path
from . import admin_views

urlpatterns = [
    path('schedule/accepted-papers/',                          admin_views.accepted_papers_panel,     name='accepted_papers_panel'),
    path('schedule/',                                          admin_views.schedule_panel,            name='schedule_panel'),
    path('schedule/new/',                                      admin_views.session_create,            name='schedule_create'),
    path('schedule/<uuid:pk>/edit/',                           admin_views.session_edit,              name='schedule_edit'),
    path('schedule/<uuid:pk>/delete/',                         admin_views.session_delete,            name='schedule_delete'),
    path('schedule/<uuid:session_pk>/papers/add/',             admin_views.session_paper_add,          name='session_paper_add'),
    path('schedule/papers/<uuid:pk>/delete/',                  admin_views.session_paper_delete,       name='session_paper_delete'),
    path('schedule/<uuid:session_pk>/subsessions/add/',        admin_views.subsession_add,            name='subsession_add'),
    path('schedule/subsessions/<uuid:pk>/delete/',             admin_views.subsession_delete,         name='subsession_delete'),
    path('schedule/<uuid:session_pk>/feedback/',               admin_views.feedback_manage,           name='schedule_feedback_manage'),
    path('schedule/<uuid:session_pk>/feedback/question/add/',  admin_views.feedback_question_add,     name='schedule_feedback_question_add'),
    path('schedule/feedback/question/<uuid:pk>/delete/',       admin_views.feedback_question_delete,  name='schedule_feedback_question_delete'),
    path('schedule/<uuid:session_pk>/feedback/toggle/',        admin_views.feedback_toggle,           name='schedule_feedback_toggle'),
    path('schedule/<uuid:session_pk>/analytics/',              admin_views.feedback_analytics,        name='schedule_analytics'),
]
