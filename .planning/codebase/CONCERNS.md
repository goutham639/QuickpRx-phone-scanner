# Codebase Concerns

**Analysis Date:** 2026-01-11

## Tech Debt

**Missing Test Suite:**
- Issue: Zero test files in the entire project
- Files affected: Entire `src/` directory
- Why: Rapid development without test infrastructure
- Impact: Changes could break functionality without detection
- Fix approach: Add Vitest, create tests for hooks and critical components

**Missing Environment Configuration Documentation:**
- Issue: No `.env.example` file for developers
- Files affected: Root directory (missing file)
- Why: Single-developer setup assumption
- Impact: New developers won't know required environment variables
- Fix approach: Create `.env.example` with `VITE_API_URL=`

**Large Hook Handling Multiple Concerns:**
- Issue: `useScannerSession.ts` handles pairing, WebSocket, reconnection, and message handling
- File: `src/hooks/useScannerSession.ts` (232 lines)
- Why: All session logic grouped together
- Impact: Harder to test and modify individual aspects
- Fix approach: Extract reconnection logic into separate hook

**Hardcoded API URL Fallback:**
- Issue: Falls back to production URL if env var missing
- File: `src/hooks/useScannerSession.ts` (line 15)
- Why: Convenience for quick setup
- Impact: Could accidentally hit production from development
- Fix approach: Remove fallback, require explicit configuration

## Known Bugs

**None identified** - Codebase appears functional

## Security Considerations

**No Critical Security Issues Found:**
- No secrets in code
- No XSS vulnerabilities (React escapes by default)
- Token handled appropriately (not stored in localStorage)
- WebSocket token passed via URL query parameter (acceptable for internal APIs)

**Minor Recommendations:**
- Risk: Console logs may expose session tokens in browser console
- Current mitigation: None
- Recommendations: Sanitize logged data in production builds

## Performance Bottlenecks

**None Critical:**
- Camera detection loop properly uses requestAnimationFrame
- Debouncing prevents duplicate barcode submissions
- WebSocket reconnection has backoff logic

**Monitoring Gaps:**
- No performance metrics collection
- No error tracking service (Sentry, etc.)

## Fragile Areas

**WebSocket Reconnection Logic:**
- File: `src/hooks/useScannerSession.ts` (lines 98-107)
- Why fragile: Multiple refs track state (wsRef, reconnectCountRef, sessionIdRef)
- Common failures: Refs out of sync with state could cause stale data
- Safe modification: Add tests before changing reconnection logic
- Test coverage: None

**Barcode Detection Loop:**
- File: `src/hooks/useBarcodeScanner.ts` (lines 46-66)
- Why fragile: RAF loop with multiple async operations
- Common failures: Detection errors logged but could accumulate silently
- Safe modification: Add error accumulator with user notification
- Test coverage: None

## Scaling Limits

**Client-Side Application:**
- Current capacity: Single user per device
- No server-side concerns in this repository
- WebSocket scales with backend capacity

## Dependencies at Risk

**Outdated Dependencies:**
- React 18.3.1 → 19.x available (major version behind)
- Vite 6.0.3 → 7.x available (major version behind)
- Tailwind CSS 3.4.17 → 4.x available (major version behind)
- barcode-detector 2.2.8 → 3.x available (major version behind)
- vite-plugin-pwa 0.21.1 → 1.x available (major version behind)

**Risk Level:** Medium - Current versions work, but security patches and features may be missed
**Migration Plan:** Plan upgrade cycle starting with React 19

## Missing Critical Features

**Empty README Documentation:**
- Problem: README.md contains only title (25 bytes)
- File: `README.md`
- Current workaround: Developers must read code to understand setup
- Blocks: Onboarding new developers
- Implementation complexity: Low (documentation task)

**Missing Error Tracking:**
- Problem: No centralized error tracking (Sentry, Rollbar, etc.)
- Current workaround: Console logs only
- Blocks: Understanding production issues
- Implementation complexity: Low (add Sentry SDK)

## Test Coverage Gaps

**All Code Untested:**
- What's not tested: 100% of codebase
- Risk: Any change could introduce regression
- Priority: High

**Critical Areas Needing Tests:**
1. `useScannerSession` - WebSocket state machine, reconnection
2. `useBarcodeScanner` - Camera initialization, detection loop
3. `PairCodeInput` - 6-digit validation, auto-submit
4. `Scanner` - Pause/resume state, scan counter

## Code Quality Notes

**Positive Observations:**
- Clean TypeScript with strict mode
- No `any` types
- Good React patterns (hooks, callbacks, cleanup)
- Proper separation of concerns
- Error handling at boundaries

**Minor Issues:**
- Console logs in production code (`src/main.tsx`, hooks)
- Some error messages not extracted from API responses properly
- No accessibility labels on some interactive elements

---

*Concerns audit: 2026-01-11*
*Update as issues are fixed or new ones discovered*
