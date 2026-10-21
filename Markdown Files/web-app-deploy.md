# Web fallback rollback and native repair: changes and file list

Regenerated: October 21, 2026.

This document explains the work done for your request to revert the web app and address native push failures and slow Notifications, Feed, and Network screens.

## 1. Which changes this report covers

| Revision | What it contains |
| --- | --- |
| `f728c63` | Earlier web fallback work and initial notification/backend repairs. |
| `2f87fbd` | The web rollback and targeted native push/loading fixes described below. This revision changed 40 files, including deleted web files and documentation. |
| `f49a80e` | A subsequent push-test commit adding root `eas.json` and changing `mobile/App.js`. This is separate from the rollback report. |

At regeneration, there were also existing uncommitted edits in `mobile/eas.json`, `mobile/src/notifications.js`, `mobile/src/screens/LoginScreen.js`, `mobile/src/screens/NotificationsScreen.js`, `mobile/src/sslFallback.js`, and `mobile/src/theme.js`. Those later edits are **not attributed to the rollback work**. They were left untouched while recreating this document.

Only this Markdown file was created for your current documentation request. No application code, server process, credentials, or build configuration was changed during regeneration.

## 2. What was reverted

- Removed the separate browser Checkpoint and Notifications screens.
- Removed the PWA HTML, manifest, Home Screen icon, service worker, and browser splash image copy.
- Removed browser dialogs, Web Push helpers, and browser permission handling.
- Removed service worker registration, browser notification routing, and the web notification banner from app startup/navigation.
- Restored the native splash component to React Native `ImageBackground`.
- Removed the `/app` build base path, explicit web export configuration, and `build:web` command.
- Removed backend Web Push subscription endpoints and browser dispatch. Both native platforms continue using Expo Push.
- Prepared an Apache configuration without the `/app/` static Alias or PWA rules.

The existing notification migration and browser-subscription model were retained for database compatibility. No tables, notification records, or server credentials were deleted. The subscription model remains unused by notification dispatch.

## 3. What was fixed in native push

The registration and delivery flow is:

```text
Notification permission
  → native FCM/APNs token
  → Expo push token
  → authenticated registration with the backend
  → notification audience selection
  → Expo send ticket
  → provider receipt
```

Saving a notice in the inbox is separate from displaying a system alert.

### Problems found and changes made

1. **Duplicate startup registration:** registration ran in both `App.js` and the permission component. Removed the extra startup call and added a shared in-flight registration promise.
2. **Broken chat push entry point:** existing chat code imported `_send_hybrid`, which was missing. Restored that function with its existing calling convention, so chat callers did not need changing.
3. **Hidden registration errors:** added bounded waits for token acquisition and backend registration, checked HTTP responses and the server's JSON acknowledgement, and exposed failures in the permission prompt.
4. **Retry after dismissal:** registration failures are no longer permanently dismissed. Added a notification setup control in the inbox to retry registration or open device settings.
5. **Token lifecycle:** retained the registered token for logout cleanup and added registration synchronization when native push tokens rotate.
6. **iOS permissions:** handled authorized, provisional, and ephemeral permission states. Registration alone does not establish whether iOS will show an audible alert.
7. **Invalid registration input:** restricted native registration to Android/iOS and valid Expo token formats. Existing installation ownership reassignment on account changes was preserved.
8. **Hidden provider failures:** improved receipt parsing/logging and made receipt failures visible in the website notification admin.
9. **Incorrect feed push success:** feed publishing no longer reports successful push when no provider accepted the notification. Post creation itself remains independent of push success.

### What was not established

During the rollback investigation, the authorized test account had no registered device token, and no iOS device tokens were registered. Other accounts had successful Expo receipts. A successful receipt confirms provider acceptance, not that a phone displayed an alert.

EAS credential inspection was blocked by the IITD proxy, so current APNs credential validity was not confirmed. Local Expo config introspection confirmed the notifications plugin and generated iOS entitlement. Physical Android/iOS alert delivery was not verified during that repair.

These are historical findings from the repair, not newly checked device counts or current delivery results.

## 4. What changed for slow screen loading

| Screen or layer | Change |
| --- | --- |
| Network | Displays attendees without waiting for discovery and block-list requests to finish. Server-side blocking and eligibility filters remain in place. |
| Network requests | Uses the existing authenticated API helper, allowing access-token refresh, HTTP error checks, and a 15-second request timeout. |
| Feed and Notifications | Uses account-specific, in-memory snapshots for quick revisits within 30 seconds, while still fetching fresh data. These snapshots clear on logout. |
| Notifications | Stops reloading solely because the access-token prop changed. Read actions also use the authenticated API helper. |
| Feed | Checks response status and structure rather than treating a failed response as a valid empty list. |
| Feed backend | Counts comments and quiz responses independently to avoid multiplying rows in a combined database join. |
| Shared API helper | Timeouts are opt-in for the affected requests; other callers retain their existing timeout behavior. |

Local API timings during investigation were roughly 0.06 seconds for Notifications, 0.23 seconds for Feed, and 0.10 seconds for Network. Those measurements were from the App VM and do not measure latency on users' phones.

## 5. Files modified in the rollback and repair

### Mobile files

| File | What changed |
| --- | --- |
| `mobile/App.js` | Removed browser setup/dialog hosting and duplicate push registration; restored native splash; clears new screen snapshots on logout. |
| `mobile/app.json` | Removed explicit web configuration and `/app` base URL; retained native notification configuration. |
| `mobile/package.json` | Removed the production web export script. |
| `mobile/src/MainApp.js` | Removed the browser notification banner/polling; passes account IDs to Feed and Notifications for snapshot isolation. |
| `mobile/src/NotificationPermissionPrompt.js` | Removed browser installation instructions; made native setup failures visible/retryable and prompt dismissal account-specific. |
| `mobile/src/notifications.js` | Added native registration coordination, permission handling, checked acknowledgement, timeouts, token persistence/rotation, and logout cleanup; removed browser unsubscribe logic. |
| `mobile/src/api.js` | Added optional request timeouts, including refresh/retry handling for affected calls. |
| `mobile/src/cache.js` | Added short-lived, account-scoped in-memory screen snapshots and logout clearing. |
| `mobile/src/screens/FeedScreen.js` | Added quick-revisit snapshots, request timeout, and response validation. |
| `mobile/src/screens/NetworkScreen.js` | Updated authenticated requests, error handling, and loading dependencies. |
| `mobile/src/screens/NotificationsScreen.js` | Added snapshots and notification setup retry; updated request, refresh, and read-action handling. |

### Backend files

| File | What changed |
| --- | --- |
| `backend/apps/notifications/admin.py` | Removed browser subscription admin registration; retained native delivery records. |
| `backend/apps/notifications/admin_views.py` | Counts native devices only; surfaces receipt failures and logs dispatch exceptions. |
| `backend/apps/notifications/fcm.py` | Removed Web Push dispatch; restored `_send_hybrid` compatibility and shared native failure tracking. |
| `backend/apps/notifications/management/commands/push_status.py` | Replaced browser readiness output with native platform/account registration counters. |
| `backend/apps/notifications/models.py` | Added a comment explaining why the retired browser model is retained. No schema change. |
| `backend/apps/notifications/tasks.py` | Hardened receipt parsing and logged provider receipt errors. |
| `backend/apps/notifications/tests.py` | Removed the retired Web Push encryption test. No new tests were added or run in this repair. |
| `backend/apps/notifications/urls.py` | Removed the three Web Push routes. |
| `backend/apps/notifications/views.py` | Removed Web Push endpoints/counting and added native registration input validation. |
| `backend/apps/posts/views.py` | Optimized feed count queries and corrected reported push success. |
| `backend/confhub/__init__.py` | Removed the optional Web Push environment bootstrap. |
| `backend/confhub/settings.py` | Removed Web Push/VAPID settings; retained native receipt scheduling. |
| `backend/requirements.txt` | Removed the `pywebpush` dependency. |
| `backend/templates/panel/notifications.html` | Displays a delivery-error badge when receipts report failure. |

### Deployment and documentation

| File | What changed |
| --- | --- |
| `deploy/apache/wordpress.conf` | Removed the `/app/` Alias, PWA headers, app rewrite, and web asset fallback exceptions; retained existing website/API/Metro routes. |
| `Markdown Files/native-push-and-loading-repair.md` | Added repair findings, validation results, and rollout instructions. |
| `Markdown Files/web-app-deploy.md` | Deleted during the rollback because it documented the retired web deployment; recreated now as this change report. |

## 6. Files deleted in the rollback

These files were specific to the browser fallback:

```text
mobile/public/index.html
mobile/public/manifest.webmanifest
mobile/public/pwa-icon.png
mobile/public/service-worker.js
mobile/public/splash-background.png
mobile/src/SplashBackground.js
mobile/src/SplashBackground.web.js
mobile/src/pushPermission.web.js
mobile/src/screens/CheckpointScreen.web.js
mobile/src/screens/NotificationsScreen.web.js
mobile/src/webDialog.js
mobile/src/webPush.js
```

The deleted `mobile/public/splash-background.png` was a browser copy. The native `mobile/assets/ETD_bgImage.png` was retained.

## 7. Existing functionality left unchanged by that repair

- Native Checkpoint implementation, distance checks, and server validation rules.
- Home and Schedule screens.
- Login and change-password screen files, including the previously requested native styling fixes.
- Networking eligibility, audience roles, and server-side blocking rules.
- Feed quiz rules, reaction behavior, comment behavior, and post visibility.
- Database migration history and stored notification records.
- `Markdown Files/important-commands.md`.

This describes the rollback revision. Later edits in the working tree, including LoginScreen changes, are separate.

## 8. Checks completed during the repair

- Android and iOS Hermes JavaScript bundle exports succeeded. These are not installable APK/IPA builds.
- Django system checks passed.
- Notification migration-state check found no new migration required.
- Changed Python files parsed, and Git whitespace checks passed.
- The original and optimized feed query returned matching ordering, comment counts, and quiz-response counts for the inspected data.
- Read-only native API/admin requests returned HTTP 200.
- After the backend reload, the retired Web Push configuration endpoint returned HTTP 404.
- No automated test suite or physical-device push delivery check was run.

These checks were recorded during the repair; regenerating this file did not rerun them against the later edits.

## 9. Deployment status and remaining steps

### App VM: backend

The backend was gracefully reloaded during the repair. Native inbox, Feed, and Network API health was checked afterward. No database schema rollback was performed.

Useful read-only diagnostics:

```bash
cd /home/baadalvm/eventapp/backend
DEBUG=False python3 manage.py push_status
DEBUG=False python3 manage.py push_status --email your-test-account@example.com
```

The existing `collect_push_receipts` command queries existing tickets; it does not send a new notification.

### Website VM: removing the public web fallback

The repository configuration was updated, but the Website VM could not be accessed from this workspace. **The public `/app/` removal was not confirmed.**

Copy `deploy/apache/wordpress.conf` to `~/wordpress.conf` on `10.17.5.38`, then apply there:

```bash
sudo cp /etc/apache2/sites-available/wordpress.conf /etc/apache2/sites-available/wordpress.conf.before-web-rollback
sudo cp ~/wordpress.conf /etc/apache2/sites-available/wordpress.conf
sudo apache2ctl configtest && sudo systemctl reload apache2
```

If validation fails, restore the backup before reloading. Check WordPress and the existing API, panel, media, and WebSocket routes after applying. The old export directory does not need to be deleted to remove its Apache mapping.

### Android and iOS clients

New native builds are needed for client changes to reach installed apps. The rollback repair did not publish either store release or change version numbers/signing credentials. Actual token registration and alert display must still be confirmed on the updated physical Android and iOS apps.
