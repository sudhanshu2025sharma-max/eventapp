from django.urls import path
from . import views

urlpatterns = [
    # Root alias
    path('', views.conversation_list, name='chat_root'),

    # Requests
    path('requests/', views.inbox, name='chat_requests_root'),
    path('requests/send/', views.send_request, name='chat_send_request'),
    path('requests/inbox/', views.inbox, name='chat_inbox_requests'),
    path('requests/sent/', views.sent_requests, name='chat_sent_requests'),
    path('requests/count/', views.request_counts, name='chat_request_counts'),
    path('requests/counts/', views.request_counts, name='chat_request_counts_alt'),
    path('requests/<uuid:request_id>/action/', views.respond_request, name='chat_respond_request'),
    path('requests/<uuid:request_id>/respond/', views.respond_request, name='chat_respond_request_alias'),
    path('requests/<uuid:request_id>/withdraw/', views.withdraw_request, name='chat_withdraw_request'),

    # Conversations & Messages
    path('conversations/', views.conversation_list, name='chat_conversations'),
    path('conversations/<uuid:conversation_id>/', views.conversation_detail, name='chat_conversation_detail'),
    path('conversations/<uuid:conversation_id>/mute/', views.toggle_mute, name='chat_conversation_mute'),
    path('conversations/<uuid:conversation_id>/messages/', views.message_list, name='chat_message_list'),
    
    # Message Send
    path('conversations/<uuid:conversation_id>/send/', views.send_message, name='chat_message_send'),
    path('conversations/<uuid:conversation_id>/messages/send/', views.send_message, name='chat_message_send_alias'),

    # Message Read
    path('conversations/<uuid:conversation_id>/read/', views.mark_messages_read, name='chat_mark_read'),
    path('conversations/<uuid:conversation_id>/messages/read/', views.mark_messages_read, name='chat_mark_read_alias'),

    path('conversations/<uuid:conversation_id>/messages/<uuid:message_id>/delete/', views.delete_message, name='chat_message_delete'),
    path('conversations/<uuid:conversation_id>/messages/<uuid:message_id>/react/', views.toggle_reaction, name='chat_message_react'),
    path('conversations/<uuid:conversation_id>/messages/<uuid:message_id>/report/', views.report_message, name='chat_message_report'),
    path('disconnect/', views.disconnect_user, name='chat_disconnect'),

    # Block / Unblock / Checks
    path('block/', views.block_user, name='chat_block_user'),
    path('unblock/', views.unblock_user, name='chat_unblock_user'),
    path('blocked/', views.blocked_list, name='chat_blocked_list'),
    path('check/bulk/', views.bulk_connection_check, name='chat_bulk_check_alt'),
    path('check/<uuid:user_id>/', views.check_connection, name='chat_check_connection'),
    path('connections/count/', views.connection_count, name='chat_connection_count'),
    path('connections/bulk-check/', views.bulk_connection_check, name='chat_bulk_check'),

    # Shake & Connect
    path('shake/', views.shake_connect, name='chat_shake_singular'),
    path('shakes/', views.shake_connect, name='chat_shake_plural'),

    # Staff Coordination & Calls
    path('staff-group/', views.staff_group_chat_view, name='staff_group_chat'),
    path('call-logs/', views.call_logs_api, name='call_logs_api'),
]
