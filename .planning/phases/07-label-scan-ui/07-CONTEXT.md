# Phase 7: Label Scan UI - Context

**Gathered:** 2026-01-14
**Status:** Ready for planning

<vision>
## How This Should Work

User selects their mode upfront — either Barcode Scan or Label Scan. Within each mode, there's a mode switch at the bottom to flip to the other mode without going back.

Label Scan is a guided flow:
1. **Enter pair code** — Join the session
2. **Take photo** — Camera with capture button
3. **Auto-upload** — Photo uploads immediately with progress/success feedback

No preview step. Fast and streamlined — capture and go.

</vision>

<essential>
## What Must Be Nailed

- **Smooth mode switching** — Easy to flip between barcode and label modes, both at entry and within flows
- **Clear guided flow** — User always knows what step they're on in the label scan process
- **Upload feedback** — Clear progress indicator and success/failure states after capture

</essential>

<boundaries>
## What's Out of Scope

- Multi-photo capture — Single photo per session for now
- OCR results display — Phone just captures and uploads, desktop shows results
- Offline support — Requires active connection to work

</boundaries>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Keep it consistent with what works.

</specifics>

<notes>
## Additional Context

This is the final phase of v2.0 Label Scan OCR. Brings together:
- Phase 5: `useLabelScanSession` hook (API client)
- Phase 6: `useLabelCapture` hook (camera/capture)

The phone is a capture device — all OCR processing and results display happens on the desktop side.

</notes>

---

*Phase: 07-label-scan-ui*
*Context gathered: 2026-01-14*
