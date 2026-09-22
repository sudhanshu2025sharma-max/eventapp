from django.urls import path
from . import views

urlpatterns = [
    # Mobile App API
    path('feed/', views.feed_list, name='feed_list_api'),
    path('feed/<uuid:pk>/react/', views.react_post, name='feed_react_api'),
    path('feed/<uuid:pk>/comments/', views.post_comments, name='feed_comments_api'),
    
    # Admin API
    path('admin/feed/', views.admin_feed_list, name='admin_feed_list_api'),
    path('admin/feed/<uuid:pk>/', views.admin_feed_detail, name='admin_feed_detail_api'),
    path('admin/feed/<uuid:pk>/comments/', views.admin_feed_comments, name='admin_feed_comments_list'),
    path('admin/feed/<uuid:pk>/comments/<uuid:comment_id>/', views.admin_feed_comments, name='admin_feed_comments_detail'),
]
