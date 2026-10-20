# Native push and loading repair — October 20, 2026

## Scope

The browser fallback was removed from app startup, Metro platform screens, public PWA assets, web export script, and backend Web Push routes and dispatch. Native notification permission handling, inbox compatibility, provider tickets, and receipt collection remain. The native Checkpoint, Home, Schedule, authentication UI, account permissions, checkpoint rules, and networking eligibility rules were not changed in this repair.

Migration `notifications.0005` and its models remain for database compatibility and existing records. Browser subscriptions are no longer used by runtime dispatch or exposed in admin. No schema rollback or record deletion is needed. Existing private VAPID values and the isolated Python environment can remain unused; this repair does not delete server credentials.

The App VM backend was gracefully reloaded after checks. Live local requests returned HTTP 200 for the native inbox, feed, and network APIs, and HTTP 404 for the retired Web Push configuration route. The Website VM's Apache rollback remains a manual deployment step below.

## Confirmed push findings

- App startup previously ran registration in both `App.js` and the permission component. The permission component now owns startup/foreground registration, and the registration helper shares an in-flight request.
- Existing chat push callers import `_send_hybrid`; that entry point was missing. It is restored with its existing calling convention and delegates to the native Expo sender.
- Token acquisition and server sync now have bounded waits, check HTTP and JSON acknowledgement, and expose errors. The native token is retained for logout cleanup and refreshed when native push tokens rotate.
- iOS authorization includes provisional/ephemeral states. Permission to register does not guarantee audible alerts; the inbox's notification setup control can retry registration or open device settings.
- Registration rejects invalid platform/token formats and preserves installation ownership reassignment when users switch accounts.
- Receipt errors are logged and shown as delivery errors in the website admin. Feed publishing no longer reports push success when the accepted count is zero. The post still publishes normally.
- Read-only inspection found 4 active Android registrations, no iOS registrations, 19 successful provider receipts, and 7 failed provider attempts. Three failures were `DeviceNotRegistered`. These are inspection-time counts and may change. The authorized test account still had no registration.
- EAS credential inspection was blocked by the IITD proxy. Current APNs credential validity is unverified. Local Expo config introspection confirms the notifications plugin and generated `aps-environment` entitlement; it does not validate an installed binary's signing or credentials.

The native flow is: permission → FCM/APNs device token → Expo token → authenticated `/notifications/tokens/` → audience dispatch → Expo ticket → receipt. Inbox persistence is independent of alert display. Both native platforms continue using Expo Push; the backend does not send browser push.

Inspect counters without printing tokens or keys:

```bash
cd /home/baadalvm/eventapp/backend
DEBUG=False python3 manage.py push_status
DEBUG=False python3 manage.py push_status --email your-test-account@example.com
DEBUG=False python3 manage.py collect_push_receipts
```

The receipt collector only checks existing tickets. Its existing five-minute cron entry remains; tickets are checked after fifteen minutes. A successful receipt means provider acceptance, not proof that an alert was displayed. No diagnostic notification was sent during this repair.

## Screen loading

- Network renders the attendee response without waiting for discovery or block-list requests. Server-side blocked-user filtering remains in place. Network calls now use the existing authenticated API helper, including token refresh, HTTP checks, and a 15-second request timeout.
- Feed and Notifications use account-scoped, in-memory snapshots for quick revisits within 30 seconds, always request fresh data, and clear those snapshots on logout. They do not persist these snapshots to disk or share them across accounts.
- Notifications no longer reloads because the access-token prop changed. Read actions also use refreshed authentication. Feed errors no longer replace a valid list with an empty success state.
- Feed comment and quiz-response counts use independent subqueries to avoid a growing comments × answers join. Counts, ordering, audience visibility, quiz rules, reactions, and comments are preserved.
- Request timeouts are opt-in; other existing API callers retain their prior timeout behavior.

Read-only local profiling returned HTTP 200 for Notifications, Feed, Network, discovery, and the notification admin. Original and optimized feed ordering/comment/quiz counts matched. These timings do not establish mobile-network latency. Android and iOS Hermes bundle exports and Django system/migration-state checks succeeded. No automated test suite or physical-device delivery check was run.

## Website rollback

`deploy/apache/wordpress.conf` removes only the `/app/` Alias, PWA headers, asset fallback exceptions, and app rewrite. Existing WordPress, API, panel, media, WebSocket, and native Metro mappings remain.

Website VM access is unavailable to this workspace. Copy that file to `~/wordpress.conf` on `10.17.5.38`, then run there:

```bash
sudo cp /etc/apache2/sites-available/wordpress.conf /etc/apache2/sites-available/wordpress.conf.before-web-rollback
sudo cp ~/wordpress.conf /etc/apache2/sites-available/wordpress.conf
sudo apache2ctl configtest && sudo systemctl reload apache2
```

If config validation fails, restore the backup before any reload. Check the WordPress home page and existing API/panel/media/WebSocket paths after applying. The old exported directory need not be deleted to stop serving it. Installed browser shortcuts can be removed by their users; the retired service worker had no offline fetch cache.

## Native rollout

New Android and iOS binaries are required for the client fixes; bundle exports are compilation checks, not installable releases. No version numbers, store submissions, or signing credentials were changed. Validate registration and actual alerts on physical Android and iOS devices before publishing the next releases.

References: [Expo setup](https://docs.expo.dev/push-notifications/push-notifications-setup/) and [notification permissions and token APIs](https://docs.expo.dev/versions/latest/sdk/notifications/).
