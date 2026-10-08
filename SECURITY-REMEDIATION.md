# Security remediation rollout

This patch addresses the 17 supplied open Codex Security findings. It is a draft until deployment configuration and platform controls below are verified.

## Deployment configuration

- Configure `RESEND_API_KEY` and a verified `VERIFICATION_FROM_EMAIL` before deploying auth. New account sign-up/sign-in sends verification mail. Billing requires `emailVerified`; signing up with an existing customer email no longer associates that customer. Conflicting legacy Polar external-ID links require support reconciliation. Verified owners retain portal access, transfer and checkout.
- Configure `POLAR_RENEWAL_PRODUCT_ID` and `POLAR_WEBHOOK_SECRET`. Renewals require a real paid order for that product. Optional manual processing uses `RENEWAL_BEARER_SECRET` and an order ID. Duplicate delivery uses a persisted receipt and per-key lease; it does not add another year.
- The public download-email endpoint requires `DATABASE_URL` for atomic email budgets. Missing storage fails closed. Requests send only the requested download email; they do not create marketing contacts.
- The native HTTP/MCP bridge now requires its persisted bearer token. Recopy the generated MCP configuration after restarting; clients must send `Authorization: Bearer <token>`. UI configuration is disabled when its saved port differs from the listening configuration.
- Native secure storage requires an available OS credential vault. Migration verifies existing ciphertexts before removing a legacy key; failures preserve the original data. Backups cannot restore executable ACP configuration. Users must explicitly configure agents again after restore.

## Verification

Focused tests cover verified-customer ownership and foreign-organization transfer rejection; paid-order checks, repeat renewals, raw-body signature tampering and stale deliveries; thumbnail/trash path rejection and normal round trips; OAuth revocation failure preserving tokens; analytics consent; download-email rate reservations with real MongoDB; pinned FFmpeg assets; authenticated MCP calls; bounded/contained backup restore; storage migration; SVG URL confinement; and verified upscaler archives.

The full native Cargo check and server/web typechecks passed. Focused desktop checks passed; the full desktop typecheck has existing unrelated StoreOptions/Sileo errors. Native helper tests passed on Linux, with official archive manifests checked for all three published platforms. Real Windows/macOS credential-vault migration and runtime execution were unavailable and remain verification requirements. No production email, renewal, transfer or deployment was performed.

The available Cloud close endpoint supports commit findings only; these repository-scan occurrences remain open until Cloud provides a supported closure operation. Merging a draft patch is separate from deployment verification.
