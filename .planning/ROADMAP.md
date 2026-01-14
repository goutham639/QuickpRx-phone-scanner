# Roadmap: QuickpRx Phone Scanner

## Overview

Deploy and evolve the QuickpRx Phone Scanner PWA at scanner.quickprx.com. Started as barcode scanner with WebSocket communication, now adding Label Scan OCR mode for photo-based prescription label capture.

## Domain Expertise

None

## Milestones

- ✅ **v1.0 Deployment** - [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) (Phases 1-4, shipped 2026-01-12)
- 🚧 **v2.0 Label Scan OCR** - Phases 5-7 (in progress)

## Completed Milestones

<details>
<summary>✅ v1.0 Deployment (Phases 1-4) — SHIPPED 2026-01-12</summary>

- [x] Phase 1: Containerization (1/1 plans) — completed 2026-01-11
- [x] Phase 2: CI/CD Pipeline (1/1 plans) — completed 2026-01-11
- [x] Phase 3: Infrastructure Integration (1/1 plans) — completed 2026-01-11
- [x] Phase 4: Scan Submit Handler (1/1 plans) — completed 2026-01-12

</details>

### 🚧 v2.0 Label Scan OCR (In Progress)

**Milestone Goal:** Add photo-based label scanning mode using REST API uploads for server-side OCR processing

#### Phase 5: Label Scan API

**Goal**: REST API client for session join and photo upload endpoints
**Depends on**: v1.0 complete
**Research**: Unlikely (standard REST patterns)
**Plans**: TBD

Plans:
- [ ] 05-01: TBD (run /gsd:plan-phase 5 to break down)

#### Phase 6: Camera Capture

**Goal**: Camera access, photo capture, and image blob handling for label photos
**Depends on**: Phase 5
**Research**: Unlikely (can adapt existing barcode camera code)
**Plans**: TBD

Plans:
- [ ] 06-01: TBD

#### Phase 7: Label Scan UI

**Goal**: New UI flow with mode switch, pair code entry, capture button, and upload feedback
**Depends on**: Phase 6
**Research**: Unlikely (React patterns established)
**Plans**: TBD

Plans:
- [ ] 07-01: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Containerization | v1.0 | 1/1 | Complete | 2026-01-11 |
| 2. CI/CD Pipeline | v1.0 | 1/1 | Complete | 2026-01-11 |
| 3. Infrastructure Integration | v1.0 | 1/1 | Complete | 2026-01-11 |
| 4. Scan Submit Handler | v1.0 | 1/1 | Complete | 2026-01-12 |
| 5. Label Scan API | v2.0 | 0/? | Not started | - |
| 6. Camera Capture | v2.0 | 0/? | Not started | - |
| 7. Label Scan UI | v2.0 | 0/? | Not started | - |
