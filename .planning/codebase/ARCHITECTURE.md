# Architecture

**Analysis Date:** 2026-01-11

## Pattern Overview

**Overall:** Single Page Application (SPA) - React PWA with Real-time WebSocket Communication

**Key Characteristics:**
- Client-only browser application (no backend code in this repo)
- Mobile-first Progressive Web App
- Real-time bidirectional communication via WebSocket
- Hooks-based architecture for business logic separation

## Layers

**Entry Point Layer:**
- Purpose: Application initialization and PWA registration
- Contains: React root mounting, service worker setup
- Location: `src/main.tsx`
- Depends on: App component
- Used by: Browser (entry point)

**App Router Layer:**
- Purpose: Session state routing between screens
- Contains: Root component with conditional rendering
- Location: `src/App.tsx`
- Depends on: Hooks layer, Component layer
- Used by: Entry point

**Hook/Logic Layer:**
- Purpose: Business logic, side effects, external communication
- Contains: Session management, camera/barcode detection
- Location: `src/hooks/useScannerSession.ts`, `src/hooks/useBarcodeScanner.ts`
- Depends on: Types, Browser APIs (WebSocket, MediaDevices, BarcodeDetector)
- Used by: Components

**Component Layer:**
- Purpose: Presentational UI components
- Contains: PairCodeInput, Scanner, ScanFeedback
- Location: `src/components/*.tsx`
- Depends on: Hooks layer, Types
- Used by: App component

**Type/Interface Layer:**
- Purpose: Shared TypeScript type definitions
- Contains: SessionStatus, PairResponse, WebSocketMessage
- Location: `src/types/index.ts`
- Depends on: Nothing (pure types)
- Used by: All other layers

## Data Flow

**Pairing Flow:**

1. User enters 6-digit code in `PairCodeInput` component
2. Component calls `useScannerSession.pair(code)`
3. Hook sends `POST /v1/scan-sessions/join` to backend
4. Server responds with `session_id` and `token`
5. Hook calls `connectWebSocket(token)`
6. WebSocket connection established
7. App.tsx renders `Scanner` component

**Scanning Flow:**

1. Scanner mounts, calls `useBarcodeScanner` hook
2. Hook requests camera access via `getUserMedia()`
3. BarcodeDetector scans video frames in RAF loop
4. On detection, callback triggers `Scanner.onScan`
5. Scanner calls `useScannerSession.sendScan(barcode)`
6. Hook sends WebSocket message `type='scan.submit'`
7. Server responds with `scan.received` acknowledgment
8. `ScanFeedback` shows 500ms green overlay confirmation

**State Management:**
- React hooks (useState, useRef) for all state
- No external state management library
- Refs used for WebSocket, stream, and detector handles
- Session state: `idle` → `pairing` → `paired` → `error`

## Key Abstractions

**Custom Hooks:**
- Purpose: Encapsulate business logic and side effects
- Examples: `useScannerSession`, `useBarcodeScanner`
- Pattern: Return objects with state values and action methods

**Session State Machine:**
- Purpose: Track pairing and scanning lifecycle
- Examples: `SessionStatus` type in `src/types/index.ts`
- Pattern: Union type with discrete states

**WebSocket Manager:**
- Purpose: Real-time communication with reconnection
- Examples: `connectWebSocket`, `disconnect` in `useScannerSession`
- Pattern: Ref-based connection with pending message queue

## Entry Points

**Browser Entry:**
- Location: `src/main.tsx`
- Triggers: Browser navigation to app URL
- Responsibilities: Mount React app, register PWA service worker

**App Entry:**
- Location: `src/App.tsx`
- Triggers: React render
- Responsibilities: Initialize session hook, route to appropriate screen

## Error Handling

**Strategy:** Try-catch at hook boundaries, error state in React

**Patterns:**
- Hooks throw/catch errors internally
- Error messages stored in React state
- User-friendly messages displayed in components
- Graceful degradation (e.g., optional vibration API check)

**Error Types:**
- Network errors: Caught in fetch/WebSocket, show retry option
- Camera errors: Permission denied, device not available
- Parse errors: WebSocket message parsing failures
- Detection errors: Logged but not fatal (continue scanning)

## Cross-Cutting Concerns

**Logging:**
- Console-based (console.log, console.error, console.debug)
- No structured logging library
- Debug logs may appear in production

**Validation:**
- TypeScript strict mode for type safety
- Runtime validation in hooks for API responses
- 6-digit code validation in PairCodeInput

**PWA Support:**
- Service worker via vite-plugin-pwa
- Offline caching of static assets
- App manifest for installability
- iOS safe area support via custom CSS

**Mobile Optimizations:**
- Viewport meta tags for mobile web
- Touch-friendly UI with large tap targets
- Haptic feedback on successful scan
- Safe area padding for notch devices

---

*Architecture analysis: 2026-01-11*
*Update when major patterns change*
