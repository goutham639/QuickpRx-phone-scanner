# Coding Conventions

**Analysis Date:** 2026-01-11

## Naming Patterns

**Files:**
- Components: PascalCase (`Scanner.tsx`, `PairCodeInput.tsx`, `ScanFeedback.tsx`)
- Hooks: camelCase with `use` prefix (`useScannerSession.ts`, `useBarcodeScanner.ts`)
- Types: camelCase (`index.ts` in types folder)
- Test files: None exist yet (recommend `*.test.ts` co-located)

**Functions:**
- Components: PascalCase (`function Scanner()`, `function PairCodeInput()`)
- Hooks: camelCase with `use` prefix (`useScannerSession()`, `useBarcodeScanner()`)
- Handlers: camelCase with `handle` prefix (`handleScan()`, `handlePauseResume()`)
- Regular functions: camelCase (`connectWebSocket()`, `detectLoop()`)

**Variables:**
- State variables: camelCase (`sessionId`, `scanCount`, `isPaused`, `lastBarcode`)
- Refs: camelCase with `Ref` suffix (`videoRef`, `streamRef`, `wsRef`, `detectorRef`)
- Constants: UPPER_SNAKE_CASE (`RECONNECT_DELAY`, `MAX_RECONNECT_ATTEMPTS`, `API_URL`)

**Types:**
- Interfaces: PascalCase with context suffix (`ScannerSessionState`, `PairResponse`, `WebSocketMessage`)
- Props interfaces: PascalCase with `Props` suffix (`ScannerProps`, `PairCodeInputProps`, `ScanFeedbackProps`)
- Type aliases: PascalCase (`SessionStatus`)
- Hook return types: PascalCase with `Use` prefix (`UseBarcodeScanner`, `UseScannerSession`)

## Code Style

**Formatting:**
- 2-space indentation
- Semicolons required
- Single quotes for strings (inferred from code)
- Line length: No hard limit enforced

**Tooling:**
- No ESLint configuration (`.eslintrc` not found)
- No Prettier configuration (`.prettierrc` not found)
- TypeScript strict mode enforces some consistency

**TypeScript:**
- Strict mode enabled (`tsconfig.json`)
- No `any` types used
- Explicit return types on hooks
- Interface over type for object shapes

## Import Organization

**Order:**
1. React imports (`import { useState, useCallback } from 'react'`)
2. Third-party imports (none used directly in components)
3. Local hooks (`import { useScannerSession } from './hooks/useScannerSession'`)
4. Local components (`import Scanner from './components/Scanner'`)
5. Type imports (`import type { SessionStatus } from '../types'`)
6. CSS imports (`import './index.css'`)

**Grouping:**
- No blank lines between import groups
- Type imports use `import type` syntax

**Path Aliases:**
- None configured (relative paths used)

## Error Handling

**Patterns:**
- Try-catch at async boundaries (`src/hooks/useScannerSession.ts` lines 122-166)
- Error state stored in React hooks
- User-friendly error messages constructed from API responses
- Graceful fallbacks for optional APIs (`if ('vibrate' in navigator)`)

**Error Types:**
- Throw on network failures, catch at hook level
- Store error messages in state for UI display
- Log with console.error for debugging

**Logging:**
- Console methods used directly
- No structured logging library
- `console.debug` for non-critical errors
- `console.error` for important failures
- `console.log` for PWA registration status

## Comments

**When to Comment:**
- Flow explanations in root components (`// Flow: No session → PairCodeInput`)
- Configuration constants at module top
- Non-obvious behavior in detection loops

**JSDoc/TSDoc:**
- Not used (TypeScript types serve as documentation)

**TODO Comments:**
- None found in codebase

## Function Design

**Size:**
- Hooks can be large (200+ lines) as they encapsulate full features
- Components kept focused on UI rendering
- Helper functions extracted for reuse

**Parameters:**
- Props destructured in function signature
- Options objects for complex configuration
- Callbacks for parent-child communication

**Return Values:**
- Hooks return objects with state and methods
- Components return JSX
- Early returns for guard clauses

## Module Design

**Exports:**
- Default exports for components (`export default function Scanner()`)
- Named exports for hooks (`export function useScannerSession()`)
- Named exports for types (`export interface ScannerSessionState`)

**Barrel Files:**
- `src/types/index.ts` exports all types
- No barrel files for components or hooks

## React Patterns

**Components:**
- Functional components only (no class components)
- Props interface defined above component
- Callbacks wrapped in `useCallback`
- Cleanup in `useEffect` return functions

**Hooks:**
- Custom hooks for business logic extraction
- `useRef` for values that shouldn't trigger re-renders
- `useState` for UI state
- `useEffect` for side effects with proper cleanup

**State Management:**
- React hooks only (no Redux, Zustand, etc.)
- Refs for WebSocket, stream, and detector handles
- State lifted to App.tsx for screen routing

---

*Convention analysis: 2026-01-11*
*Update when patterns change*
