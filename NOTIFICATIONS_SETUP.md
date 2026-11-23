# Notifications — how they work (no Blaze plan required)

Task Pilot has **two** notification layers. The first works out of the box on
the **free Spark plan**; the second (OS push) is optional and also Spark-safe
because it runs on Supabase, **not** Firebase Cloud Functions.

> ⚠️ Do **not** deploy `functions/index.js` senders — Cloud Functions require
> Blaze. All push sending goes through the Supabase Edge Function `/functions/v1/send-push`.

---

## 1. In-app notifications — ✅ work with zero setup

The bell / Notifications screen is backed by the Firestore `notifications`
collection (plain reads/writes, allowed by the security rules). These work on
Spark immediately and are unified across web + mobile:

- **Task assigned** → each assignee gets a notification.
- **Task status changed** → the task's creator gets a notification.
- **Admin broadcast** (Admin → Notification Center) → targeted or everyone.

Schema (both platforms write/read the same shape):

```
notifications/{id} = {
  userId: "<recipient uid>" | "",   // "" = broadcast
  type, title, body, relatedId, relatedType,
  isRead: { "<uid>": true },         // per-user read state (a map)
  createdAt
}
```

Nothing to configure — this is live.

---

## 2. Push notifications (OS alerts) — optional, Spark-safe

Push is sent by the Supabase Edge Function `/functions/v1/send-push`, which the
web (`notifyPush`) and mobile (`PushSender`) call. It verifies the caller's
Firebase token and reconstructs recipients server-side.

### a) Supabase — service account (required for ANY push)

Firebase Console → Project Settings → **Service accounts** → *Generate new
private key*. In Supabase CLI or Dashboard, set the secret:

```bash
npx supabase secrets set FIREBASE_SERVICE_ACCOUNT='<paste the entire service-account JSON>' --project-ref ximaqbhnykyxxgiqbwoh
```

Then deploy the function:
```bash
npx supabase functions deploy send-push --project-ref ximaqbhnykyxxgiqbwoh --no-verify-jwt --use-api
```

(Without this, the function returns "Server misconfigured".)

### b) Mobile — point it at your Supabase function

The app sends push by POSTing to your deployed function. Set the endpoint —
either edit `kurickal_tms/lib/core/config/push_config.dart`, or build with:

```bash
flutter run \
  --dart-define=PUSH_ENDPOINT=https://ximaqbhnykyxxgiqbwoh.supabase.co/functions/v1/send-push
```

Mobile devices already register their FCM token on login, so they **receive**
push as soon as a sender is configured.

### c) Web — receive push (optional)

Web push needs a VAPID key: Firebase Console → Project Settings → **Cloud
Messaging** → *Web Push certificates* → **Generate key pair**. Then in the web
`.env`:

```
VITE_FIREBASE_VAPID_KEY = <the key pair value>
```

On the next login the browser asks for notification permission and registers
its token (`public/firebase-messaging-sw.js` handles background messages).
Web push requires HTTPS.

---

## Quick test

1. Configure §2a (and §2b for mobile-initiated push).
2. From the web app, assign a task to another user → that user gets an in-app
   notification immediately, and a push if their device/browser is registered.
3. Admin → Notification Center → send a broadcast → everyone gets it.

## Summary

| Capability | Needs | Works on Spark |
|---|---|---|
| In-app notifications (bell) | nothing | ✅ now |
| Mobile **receives** push | §2a (service account) + a sender | ✅ |
| Mobile **sends** push | §2b (PUSH_ENDPOINT) | ✅ |
| Web **sends** push | §2a (Supabase Endpoint URL) | ✅ |
| Web **receives** push | §2c (VAPID key) | ✅ |
