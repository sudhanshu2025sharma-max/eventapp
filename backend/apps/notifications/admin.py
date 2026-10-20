from django.contrib import admin
from .models import DeviceToken, Notification, UserNotification, NotificationAttachment, WebPushSubscription, PushDelivery


@admin.register(WebPushSubscription)
class WebPushSubscriptionAdmin(admin.ModelAdmin):
    list_display = ('user', 'is_active', 'updated_at')
    list_filter = ('is_active',)
    search_fields = ('user__email', 'endpoint')


@admin.register(PushDelivery)
class PushDeliveryAdmin(admin.ModelAdmin):
    list_display = ('notification', 'platform', 'status', 'ticket_id', 'receipt_checked_at', 'created_at')
    list_filter = ('platform', 'status')
    search_fields = ('ticket_id', 'token', 'error')


admin.site.register(DeviceToken)
admin.site.register(Notification)
admin.site.register(UserNotification)
admin.site.register(NotificationAttachment)

# Register your models here.
