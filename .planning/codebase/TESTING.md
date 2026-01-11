# Testing Patterns

**Analysis Date:** 2026-01-11

## Test Framework

**Runner:**
- None configured

**Assertion Library:**
- Not applicable

**Run Commands:**
```bash
# No test scripts defined in package.json
```

## Test File Organization

**Location:**
- No test files exist

**Naming:**
- Not established (recommend `*.test.ts` co-located with source)

**Structure:**
```
# Recommended structure (not implemented):
src/
  hooks/
    useScannerSession.ts
    useScannerSession.test.ts
  components/
    Scanner.tsx
    Scanner.test.tsx
```

## Test Structure

**Suite Organization:**
- Not applicable (no tests exist)

**Recommended Pattern:**
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('useScannerSession', () => {
  describe('pair', () => {
    it('should send POST to join endpoint', async () => {
      // arrange
      // act
      // assert
    });

    it('should handle network errors', async () => {
      // test code
    });
  });
});
```

**Patterns:**
- Not established

## Mocking

**Framework:**
- Not configured

**Patterns:**
- Not established

**What Would Need Mocking:**
- `navigator.mediaDevices.getUserMedia()` - Camera access
- `WebSocket` - Real-time communication
- `fetch` - API calls
- `BarcodeDetector` - Barcode detection
- `requestAnimationFrame` - Animation loop

## Fixtures and Factories

**Test Data:**
- Not established

**Recommended Location:**
- `src/__tests__/fixtures/` for shared test data
- Factory functions in test files for dynamic data

## Coverage

**Requirements:**
- Not configured

**Configuration:**
- Not set up

**View Coverage:**
```bash
# Not available
```

## Test Types

**Unit Tests:**
- Not implemented
- Recommended for: `useScannerSession`, `useBarcodeScanner` hooks

**Integration Tests:**
- Not implemented
- Recommended for: Component interactions, WebSocket message flow

**E2E Tests:**
- Not implemented
- Recommended for: Full pairing → scanning flow

## Code Testability Analysis

**Positive Patterns:**
- Hooks are isolated and can be tested with React Testing Library
- Components receive callbacks as props (easy to mock)
- Clear interfaces with TypeScript types
- Separation of concerns between hooks and components

**Barriers to Testing:**
- Browser APIs used directly (MediaDevices, WebSocket, BarcodeDetector)
- Third-party library deep integration (barcode-detector)
- No dependency injection pattern
- Vite-specific imports (`virtual:pwa-register`)

## Recommended Test Setup

**Framework:**
- Vitest (integrates well with Vite)

**Libraries:**
- @testing-library/react
- @testing-library/user-event
- msw (Mock Service Worker for API mocking)

**Configuration Files Needed:**
- `vitest.config.ts`
- `src/setupTests.ts` (for global mocks)

**Priority Test Coverage:**
1. `useScannerSession` - WebSocket reconnection, error handling
2. `useBarcodeScanner` - Detection loop, debouncing
3. `PairCodeInput` - Form validation, auto-submit
4. `Scanner` - Pause/resume, scan feedback

---

*Testing analysis: 2026-01-11*
*Update when test patterns are established*
