# Phase 4: Scan Submit Handler - Context

**Gathered:** 2026-01-12
**Status:** Ready for research

<vision>
## How This Should Work

When a phone scans a barcode, it sends a `scan.submit` message to the realtime-gateway. The gateway validates the barcode format and session, then forwards the barcode to the desktop session. The desktop receives the barcode and auto-populates it into the active input field on PillRoute.

The phone gets immediate feedback — a visual checkmark on success, or an error message if something went wrong (invalid barcode format, session not found, etc.). The flow should feel instant and reliable.

</vision>

<essential>
## What Must Be Nailed

- **Reliable delivery** - If the session is valid, the scan must reach the desktop
- **Fast feedback** - Phone gets confirmation or error immediately after scanning
- **Visual checkmark** - Brief success indicator on phone, then ready for next scan
- **Auto-populate** - Desktop input field receives the barcode automatically

</essential>

<boundaries>
## What's Out of Scope

- No barcode/drug database lookups - just relay the raw barcode string
- No scan history or tracking of past scans
- No desktop-side logic beyond populating the input field
- Keep it minimal - validate, relay, confirm

</boundaries>

<specifics>
## Specific Ideas

- Phone sends: `{ type: 'scan.submit', session_id, barcode }`
- Gateway validates session exists and barcode is non-empty
- On success: forward to desktop, send confirmation to phone
- On failure: send error message back to phone with reason

</specifics>

<notes>
## Additional Context

Both reliability and fast feedback are equally critical. The user should never wonder "did that scan go through?" — they should know immediately.

</notes>

---

*Phase: 04-scan-submit-handler*
*Context gathered: 2026-01-12*
