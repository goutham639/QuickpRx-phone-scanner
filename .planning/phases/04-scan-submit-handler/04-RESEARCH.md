# Phase 4: Scan Submit Handler - Research

**Researched:** 2026-01-12
**Domain:** WebSocket message handling in realtime-gateway
**Confidence:** HIGH

<research_summary>
## Summary

Researched the realtime-gateway and order-service codebases to understand how to implement the scan.submit handler. **Key finding: The scan.submit handler already exists and is fully functional.**

The complete flow is implemented:
1. Phone sends `scan.submit` → realtime-gateway receives (lines 145-211)
2. Gateway validates token type and forwards to order-service
3. Order-service stores barcode and publishes Redis event (lines 269-374)
4. Gateway broadcasts `scan.item.added` to desktop clients (lines 426-441)
5. Desktop receives barcode and displays it

**Primary recommendation:** Verify existing implementation works end-to-end. No new handler code needed - Phase 4 may be complete pending testing.
</research_summary>

<standard_stack>
## Standard Stack

### Core (Already Implemented)
| Library | Version | Purpose | Location |
|---------|---------|---------|----------|
| ws | Latest | WebSocket server | realtime-gateway |
| express | Latest | HTTP server for upgrade | realtime-gateway |
| redis (ioredis) | Latest | Pub/sub for event broadcasting | shared/valkey.ts |
| prisma | Latest | Database ORM | order-service |
| jsonwebtoken | Latest | Session token generation/validation | order-service |

### Message Flow
| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| scan.submit handler | realtime-gateway/src/index.ts | 145-211 | Receive from phone, forward to order-service |
| submitScan controller | order-service/src/controllers/scanSessionController.ts | 269-374 | Store barcode, publish event |
| Redis broadcast | realtime-gateway/src/index.ts | 426-441 | Forward scan.item.added to desktop |
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Message Format (Phone → Gateway)
```typescript
// Phone sends:
{
  type: 'scan.submit',
  session_id: 'SCAN-XXXX',
  barcode: '012345678901'
}
```

### Response Patterns (Gateway → Phone)
```typescript
// Success:
{ type: 'scan.confirmed', data: { id, barcode, scanned_at } }

// Errors:
{ type: 'scan.error', error: 'Missing session_id or barcode' }
{ type: 'scan.error', error: 'Invalid token type for scan submission' }
{ type: 'scan.error', error: 'Internal error storing scan' }
```

### Broadcast Pattern (Gateway → Desktop)
```typescript
// Published to Redis channel: realtime:scan_session_item_added
{
  type: 'scan.item.added',
  data: {
    session_id: 'SCAN-XXXX',
    id: 123,
    barcode: '012345678901',
    scanned_at: '2026-01-12T...',
    pharmacy_pk: 1
  }
}
```

### Token Authentication
- Phone joins with 6-digit pair code → receives JWT with `type: 'scan_session'`
- JWT contains: `session_id`, `session_pk`, `pharmacy_pk`, `type`
- Token passed via WebSocket query param: `ws://host/ws?token=<jwt>`
- Gateway validates token type is `scan_session` before processing scan.submit
</architecture_patterns>

<existing_implementation>
## Existing Implementation Details

### realtime-gateway scan.submit Handler (index.ts:145-211)
```typescript
if (message.type === 'scan.submit') {
    const { session_id, barcode } = message;

    // Validation
    if (!session_id || !barcode) {
        ws.send(JSON.stringify({ type: 'scan.error', error: 'Missing session_id or barcode' }));
        return;
    }

    // Token type check
    if (user.type !== 'scan_session') {
        ws.send(JSON.stringify({ type: 'scan.error', error: 'Invalid token type for scan submission' }));
        return;
    }

    // Forward to order-service
    const response = await fetch(`${orderServiceUrl}/v1/scan-sessions/${session_id}/scan`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${clientToken}`,
        },
        body: JSON.stringify({ barcode }),
    });

    // Response to phone
    if (response.ok) {
        ws.send(JSON.stringify({ type: 'scan.confirmed', data: result.item }));
    } else {
        ws.send(JSON.stringify({ type: 'scan.error', error: result.error }));
    }
}
```

### order-service submitScan (scanSessionController.ts:269-374)
- Validates session token matches session ID
- Checks session status is PAIRED or ACTIVE
- Checks session not expired
- Activates session on first scan (PAIRED → ACTIVE)
- Stores barcode in `scan_session_items` table
- Publishes `realtime:scan_session_item_added` event

### Redis Broadcasting (index.ts:426-441)
- Subscribes to `realtime:scan_session_item_added` channel
- Broadcasts to clients where `client.user.pharmacy_pk === pharmacy_pk` or admin
</existing_implementation>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Already Exists | Location |
|---------|-------------|----------------|----------|
| Message handling | Custom WebSocket handler | scan.submit handler | index.ts:145-211 |
| Session validation | Custom auth | JWT token verification | index.ts:168-175 |
| Barcode storage | Custom DB logic | submitScan controller | scanSessionController.ts |
| Event broadcasting | Custom pub/sub | Redis subscription | index.ts:426-441 |
| Session tokens | Custom token system | JWT with scan_session type | scanSessionController.ts:170-179 |

**Key insight:** The entire scan.submit flow is implemented. There's nothing to hand-roll.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Token Type Mismatch
**What goes wrong:** Regular user tokens rejected by scan.submit handler
**Why it happens:** Handler checks `user.type !== 'scan_session'`
**How to avoid:** Phone must use token from `/v1/scan-sessions/join` endpoint, not regular auth token
**Warning signs:** Error "Invalid token type for scan submission"

### Pitfall 2: Session Expiry
**What goes wrong:** Scans fail after 15 minutes
**Why it happens:** Session tokens expire after 15 minutes (JWT expiresIn)
**How to avoid:** Phone should handle reconnection, re-join session if token expired
**Warning signs:** WebSocket closed with code 1008 "Token expired"

### Pitfall 3: Missing pharmacy_pk in Broadcast
**What goes wrong:** Desktop doesn't receive scan events
**Why it happens:** Broadcast filters by `client.user.pharmacy_pk === pharmacy_pk`
**How to avoid:** Ensure pharmacy_pk is included in event payload (already done in submitScan)
**Warning signs:** Phone shows confirmed but desktop doesn't update
</common_pitfalls>

<verification_needed>
## Verification Needed

Since the implementation exists, Phase 4 should focus on:

1. **End-to-end testing:**
   - Phone scans barcode → Gateway receives scan.submit
   - Gateway forwards to order-service → Barcode stored
   - Redis event published → Desktop receives scan.item.added
   - Phone shows checkmark confirmation

2. **Error scenarios:**
   - Invalid session ID → Phone shows error
   - Expired session → Phone shows error
   - Network disconnect → Phone queues scan for retry

3. **Integration verification:**
   - Confirm phone PWA sends correct message format
   - Confirm desktop useScanSession hook handles scan.item.added
   - Confirm visual feedback on both ends
</verification_needed>

<sources>
## Sources

### Primary (HIGH confidence)
- `/Users/gautampaladugu/Downloads/PillRoute/backend/services/realtime-gateway/src/index.ts` - Full WebSocket handler with scan.submit (lines 145-211) and Redis broadcast (lines 426-441)
- `/Users/gautampaladugu/Downloads/PillRoute/backend/services/order-service/src/controllers/scanSessionController.ts` - Session management and submitScan (lines 269-374)

### Client-Side References
- `phone-scanner/src/hooks/useScannerSession.ts` - Phone WebSocket client, sends scan.submit
- `pharmacist-portal/src/hooks/useScanSession.ts` - Desktop listener for scan.item.added
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: WebSocket message handling (ws library)
- Ecosystem: Redis pub/sub, JWT authentication, Prisma ORM
- Patterns: Message routing, token validation, event broadcasting
- Pitfalls: Token expiry, session state, pharmacy filtering

**Confidence breakdown:**
- Existing implementation: HIGH - Verified in source code
- Message flow: HIGH - Traced through all components
- Error handling: HIGH - Error cases documented in code
- Integration: MEDIUM - Needs end-to-end testing

**Research date:** 2026-01-12
**Valid until:** N/A (implementation already exists)
</metadata>

---

*Phase: 04-scan-submit-handler*
*Research completed: 2026-01-12*
*Ready for planning: Yes - implementation exists, needs verification*
