from django.urls import path
from . import views

urlpatterns = [
    path('',          views.list_speakers, name='speaker_list_api'),
    path('<int:pk>/', views.speaker_detail, name='speaker_detail_api'),
]
