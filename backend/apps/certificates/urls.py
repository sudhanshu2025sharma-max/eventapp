from django.urls import path
from . import views

urlpatterns = [
    path('my/', views.my_certificates, name='api_my_certificates'),
]
