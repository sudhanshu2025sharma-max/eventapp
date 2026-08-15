from django.urls import path
from . import views

urlpatterns = [
    path('feed/', views.feed_list, name='feed_list_api'),
    path('feed/<uuid:pk>/react/', views.react_post, name='feed_react_api'),
    path('feed/<uuid:pk>/comments/', views.post_comments, name='feed_comments_api'),
]
