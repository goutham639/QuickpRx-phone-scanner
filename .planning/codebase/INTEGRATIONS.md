# External Integrations

**Analysis Date:** 2026-01-11

## APIs & External Services

**QuickPRx Backend API:**
- Primary backend service for session management
  - Base URL: Environment variable `VITE_API_URL` (defaults to `https://api.quickprx.com`)
  - Configuration: `src/vite-env.d.ts`, `src/hooks/useScannerSession.ts`

**REST Endpoints:**
- `POST /v1/scan-sessions/join` - Pair device with session using 6-digit code
  - Location: `src/hooks/useScannerSession.ts` (line 123)
  - Returns: `session_id` and authentication `token`

**Payment Processing:**
- Not detected

**Email/SMS:**
- Not detected

**Analytics:**
- Not detected

**Error Tracking:**
- Not detected

## Data Storage

**Databases:**
- Not detected (client-only application)

**File Storage:**
- Not detected

**Caching:**
- PWA service worker caches static assets via Workbox
  - Configuration: `vite.config.ts` (line 40)
  - Glob patterns: `**/*.{js,css,html,ico,png,svg,woff2}`

## Authentication & Identity

**Auth Provider:**
- Token-based authentication via QuickPRx backend
  - Implementation: Session token returned from pairing endpoint
  - Token storage: React state and refs in `src/hooks/useScannerSession.ts` (lines 151-153)
  - Passed via WebSocket URL query parameter

**OAuth Integrations:**
- Not detected

## Real-time Communication

**WebSocket:**
- QuickPRx real-time scanning session
  - Endpoint: `ws://{API_URL}/ws?token={token}`
  - Location: `src/hooks/useScannerSession.ts` (lines 45-115)
  - Message Types (Incoming):
    - `connected` - Successful connection
    - `error` - Error notifications
    - `session.closed` - Session termination
    - `scan.received` - Server acknowledgment of scan
  - Message Types (Outgoing):
    - `scan.submit` - Barcode submission from client
  - Reconnection: 5 max attempts, 3-second delay (`src/hooks/useScannerSession.ts` lines 18-19, 98-107)

## Hardware Integration

**Camera Access:**
- WebRTC MediaStream API
  - Location: `src/hooks/useBarcodeScanner.ts` (lines 74-81)
  - Configuration: `facingMode: 'environment'` (rear camera)
  - Resolution: 1280x720 (ideal)

**Haptic Feedback:**
- Navigator Vibration API
  - Location: `src/components/Scanner.tsx` (lines 35-37)
  - Feature-detected before use

## Monitoring & Observability

**Error Tracking:**
- Not detected (console logging only)

**Analytics:**
- Not detected

**Logs:**
- Console-based logging in development
  - PWA registration: `src/main.tsx` (lines 11, 14)
  - WebSocket errors: `src/hooks/useScannerSession.ts` (line 85)
  - Detection errors: `src/hooks/useBarcodeScanner.ts` (line 63)

## CI/CD & Deployment

**Hosting:**
- Not configured in repository (likely external)

**CI Pipeline:**
- Not detected

## Environment Configuration

**Development:**
- Required env vars: `VITE_API_URL` (optional, has fallback)
- Secrets location: No `.env.example` found (missing)
- Fallback: Uses `https://api.quickprx.com` if not set

**Staging:**
- Not detected

**Production:**
- Environment variables set at build time via Vite
- PWA manifest generated at build (`vite.config.ts` lines 8-42)

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

---

*Integration audit: 2026-01-11*
*Update when adding/removing external services*
