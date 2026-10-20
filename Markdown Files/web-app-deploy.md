# ETD 2026 web app deployment

## October 20 notification and browser repair

### Android registration diagnosis

The diagnostic notice is visible in the authorized test account's inbox, but that account has no registered native device token. Inbox delivery therefore does not establish push delivery. The backend now reassigns an existing installation token on account changes instead of failing its unique constraint. The updated Android client creates notification channels before requesting permission, awaits server registration, and displays registration failures with a retry action.

An internal preview APK was submitted to EAS as build `bdf3c4a0-55ae-4083-9b98-ba13254da2fc`: [build status and download](https://expo.dev/accounts/coder2026s-team/projects/etd2026/builds/bdf3c4a0-55ae-4083-9b98-ba13254da2fc). This is an internal test build, not a Play Store release. Existing EAS FCM v1 credentials match the bundled Firebase project; their presence does not prove provider delivery. Once an installation registers, retry the existing authorized diagnostic notice only for that account and inspect its ticket and receipt.

The App VM repair applied notification migration `0005`, created a VAPID key pair in the private `backend/.env`, installed `pywebpush` in `backend/.push-venv`, and gracefully reloaded Gunicorn. `confhub/__init__.py` adds those optional packages for both web workers and existing management commands. Keep the VAPID pair stable and backed up with the server environment; rotating it invalidates existing browser subscriptions.

Check current readiness without printing credentials:

```bash
cd /home/baadalvm/eventapp/backend
DEBUG=False python3 manage.py push_status
DEBUG=False python3 manage.py collect_push_receipts
```

The receipt command only queries existing Expo tickets. It is scheduled every five minutes in the app user's crontab and does not require Celery. Successful provider receipts confirm provider acceptance, not that a phone displayed a banner. The published Android client is supported by both `id` and `notification_id` in inbox responses and by singular/plural mark-read requests. Installation tokens are unique: registration looks up by token and reassigns ownership to the current authenticated user, avoiding the previous uniqueness error after account changes.

The new web build includes the viewport/overscroll fixes, full-height authentication background, browser splash image, and first-use permission explanation. It must be copied to the Website VM before users receive those frontend changes. The Apache configuration already installed for `/app/` does not need changing for this release.

On the App VM:

```bash
rsync -av /home/baadalvm/eventapp/mobile/web-build/ baadalvm@10.17.5.38:etd2026-app-upload/
```

On the Website VM:

```bash
sudo rsync -av --chmod=D755,F644 ~/etd2026-app-upload/ /var/www/etd2026-app/
```

Copy the entire directory so `splash-background.png`, HTML, and hashed JavaScript files stay consistent. Keep older hashed files during the conference. Close and reopen the installed PWA after deployment. The native permission/channel and authentication UI changes require a new Android build and release; backend inbox and sender repairs apply to the existing published app.

The Expo web output is a static production bundle. It is served by Apache on the Website VM under `/app/`; Metro/Expo development servers are not production servers. This repository change prepares the app and documents the host steps. It does not edit the live Website VM.

Website VM: `10.17.5.38`. App VM: `10.17.9.48`. Public URL: `https://etd2026.iitd.ac.in/app/`. The private IP is for deployment and internal proxy routing; browser users must use the public HTTPS URL for location and Web Push.

## Step 1: isolate and build the web frontend

Checkpoint uses Metro's platform file resolution:

| Platform | Screen file |
| --- | --- |
| Android and iOS native | `mobile/src/screens/CheckpointScreen.js` (original implementation) |
| Browser and installed PWA | `mobile/src/screens/CheckpointScreen.web.js` |

Both are imported as `./screens/CheckpointScreen`; do not add the `.js` extension or change navigation. Keep the files together so relative imports remain valid. Use another `.web.js` screen only when that screen needs browser changes. Home, Schedule, and Feeds continue to use their existing shared screens.

The web Checkpoint keeps the existing layout, distance calculations, and checkpoint endpoints. Its map uses an isolated Leaflet iframe, directions open Maps, and photo capture uses the browser camera picker. Browser location uses `navigator.geolocation` with permission, unavailable, and low accuracy states. Tap the GPS status to retry. The existing 35m accuracy cutoff is retained; server validation remains authoritative.

Complete the production export and device checks before proceeding to host changes. Existing push changes from the previous implementation remain in the working tree; do not deploy those backend changes as part of the static frontend step.

## Build

```bash
cd /home/baadalvm/eventapp/mobile
npm run build:web
```

Copy the **contents** of `mobile/web-build/` to `/var/www/etd2026-app/` on the Website VM. Keep the directory writable only by the deploy account and readable by Apache.

The PWA HTML template is `mobile/public/index.html`; its manifest, Apple icon, and install metadata are available before JavaScript runs. Notifications also have a separate `NotificationsScreen.web.js`. Native Checkpoint retains its original implementation; the native notification inbox keeps its existing UI with token-refresh, retry, and ID compatibility fixes.

For the actual vhost supplied by the user, the complete replacement is `deploy/apache/wordpress.conf`. It preserves every existing proxy mapping, adds `/app/` outside the WordPress DocumentRoot, redirects the bare `/app` URL explicitly to HTTPS, and prevents missing bundled assets from receiving fallback HTML. Back up `/etc/apache2/sites-available/wordpress.conf`, copy the build, install this replacement, then run `apache2ctl configtest` before reloading Apache.

Stage `mobile/web-build/` and `deploy/apache/wordpress.conf` in the Website VM user's home directory first; use sudo there to publish to `/var/www/etd2026-app/` and install the vhost. Keep older hashed assets during the initial deployment so existing browser sessions can still request them. Verify WordPress `/`, the API, panel, media, and WebSockets after the reload as well as `/app/`, its manifest, service worker, and JavaScript bundles.

## Apache site configuration

On `10.17.5.38`, first inspect and back up the active virtual host and WordPress rewrite configuration. Add this inside the existing `etd2026.iitd.ac.in` port 80 virtual host. Keep existing `/api/`, `/media/`, `/ws/`, `/panel/`, and WordPress rules. Ensure the WordPress rewrite rules exclude `/app/` so they cannot consume app routes. If an existing catch-all proxy rule matches `/app/`, add `ProxyPass /app/ !` before that catch-all. An Alias serves this static export directly; no additional Expo upstream process is required.

```apache
RedirectMatch 301 ^/app$ /app/
Alias /app/ /var/www/etd2026-app/

<Directory /var/www/etd2026-app>
    Options FollowSymLinks
    AllowOverride None
    Require all granted
    DirectoryIndex index.html
    FallbackResource /app/index.html
</Directory>

AddType application/manifest+json .webmanifest
<LocationMatch "^/app/(manifest\.webmanifest|service-worker\.js)$">
    Header set Cache-Control "no-cache"
    Header set Service-Worker-Allowed "/app/"
</LocationMatch>
```

Because the IITD gateway terminates HTTPS in front of Apache, verify externally that `/app/`, its static chunks, and the service worker all use HTTPS and that `service-worker.js` is served from `/app/` with JavaScript content type. Validate the vhost with `apache2ctl configtest`, then reload Apache. Check `/app/` and a nested client route while confirming the WordPress home page and existing API paths still work.

## Web Push configuration

Install the backend dependency from `backend/requirements.txt`, run Django migrations, and set `WEBPUSH_VAPID_PUBLIC_KEY`, `WEBPUSH_VAPID_PRIVATE_KEY`, and `WEBPUSH_VAPID_SUBJECT` in the App VM environment. Generate one URL-safe VAPID key pair with `npx --yes web-push generate-vapid-keys`; set its public and private values in the matching environment variables and keep the private key secret. The public key is returned to authenticated clients by `/api/v1/notifications/web-push/config/`.

Restart the Django workers after applying the migration and environment variables. Celery is declared and configured in the repository, but running worker and Beat processes have not been verified. The `collect-expo-push-receipts` schedule requires both processes to be active. A successful Expo receipt means acceptance by the downstream push provider; it does not prove that a phone displayed an alert. Web Push subscriptions are stored separately from Expo device tokens.

Generate VAPID keys on a trusted machine with working npm access if the IITD proxy blocks downloads. Use the backend's existing Python environment for dependencies. The requirements file has pre-existing contradictory Celery constraints (`celery==5.3.6` and `celery>5.3.6`); resolve these before a full dependency installation. Backend dependency installation, migrations, VAPID configuration, and worker activation are separate steps from the static frontend deployment. Until the configuration endpoint supplies a public key, the browser notification screen displays a pending setup state.

On iPhone/iPad, users must add `/app/` to the Home Screen and allow notifications from the in-app Enable control. Browser push is unavailable to ordinary iOS Safari tabs; those users continue to see notifications in the app inbox and the in-app banner while the app is open.
