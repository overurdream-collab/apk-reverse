# Independent Delivery Marketplace — Mrsool Functional Reference (POC)

> **Not affiliated with MRSOOL.** No Mrsool APK was downloaded, decompiled, modified or redistributed. No trademark, UI asset, API, account, database or private information from Mrsool is used. The prototype implements familiar, publicly documented on-demand courier workflows with original code and appearance.

## What is verified about the reference

- Official Android package: \`com.mrsool\`, Google Play: https://play.google.com/store/apps/details?id=com.mrsool
- Official help-center workflow: pickup/drop-off -> submit request -> receive courier offers -> customer chooses offer -> message/call -> track delivery:
  https://help.sa.mrsool.co/ar/articles/8345106-%D9%85%D8%A7%D9%87%D9%88-%D9%85%D8%B1%D8%B3%D9%88%D9%84
- Mrsool's publicly available courier terms prohibit reverse engineering and extraction of internal source/design without permission. See section 5:
  https://s.mrsool.co/terms

This is a **clean-room-style functional prototype based only on public documentation**, not an APK reverse-engineering result. The terms cited above govern couriers and may not cover every context; permission or legal review would be needed before an APK-specific investigation.

## Run locally (no dependencies)

From the repository root:

\`\`\`sh
cd experiments/delivery-marketplace
python3 -m http.server 8000
# Open http://localhost:8000/
\`\`\`

The app has no server/API: it uses localStorage only. Everything is simulated; it does **not** send real requests, payments or messages.

## Try the full workflow

1. **Customer**: create a request with pickup, drop-off and description.
2. **Courier**: submit an integer YER offer using "Courier A"; change selector to "Courier B" and submit another.
3. **Customer**: accept one offer; subsequent bids are rejected.
4. **Customer + selected courier**: exchange local chat messages.
5. **Selected courier**: mark item picked up, then delivered.
6. **Customer**: confirm delivery.
7. **Admin**: inspect order states and counters. Reset demo data when finished.

## Test

\`\`\`sh
node --test experiments/delivery-marketplace/core.test.mjs
\`\`\`

Tests cover the order lifecycle, invalid/duplicate bids, courier permission, state-transition guards, customer confirmation, cancellation and damaged local demo storage.

## Scope and limits

| Capability | POC |
| --- | --- |
| Arabic RTL responsive customer/courier/admin UI | Implemented |
| Order request and pickup/drop-off text | Implemented |
| Two mocked courier identities and competing offers | Implemented |
| Accept an offer, prevent later bids | Implemented |
| Local chat simulation and delivery confirmation | Implemented |
| Integer-only YER fee representation | Implemented |
| Local browser persistence | Implemented |
| Automated core unit tests | Implemented |
| Real authentication/RBAC | Not implemented |
| Server, PostgreSQL and concurrent orders | Not implemented |
| Geolocation/maps/navigation | Not implemented |
| Push notifications, live chat, payments, settlement | Not implemented |
| Device APK unpack/rebuild or actual mobile APK | Not attempted |
| Real physical delivery | Not implemented |

## Next steps, if separately authorized

1. Build a proper Android application with original Kotlin/Jetpack Compose UI and a backend.
2. Add real identities, server-enforced permissions, authoritative audit log, distance/location, estimated fares, and robust settlement rules.
3. Run protected security tests only on our own APK or on other software with express authorization. Test apk-reverse against an explicitly licensed sample and document APK/Dex/repack/build checks.
4. Build and test an APK in a clean Android SDK environment, then conduct handset testing.

Current prototype must **not** be deployed as a real dispatch or payment service.
