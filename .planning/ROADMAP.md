# Roadmap: QuickpRx Phone Scanner Deployment

## Overview

Deploy the QuickpRx Phone Scanner PWA to scanner.quickprx.com with automated CI/CD. The journey: containerize the static app, create GitHub Actions for automated builds, then integrate with the existing PillRoute infrastructure (docker-compose and nginx).

## Domain Expertise

None

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Containerization** - Dockerfile for static SPA serving with nginx
- [x] **Phase 2: CI/CD Pipeline** - GitHub Actions workflow for build and deploy to DOCR
- [ ] **Phase 3: Infrastructure Integration** - Update docker-compose and nginx for scanner.quickprx.com

## Phase Details

### Phase 1: Containerization
**Goal**: Create a Docker image that serves the built PWA static files via nginx
**Depends on**: Nothing (first phase)
**Research**: Unlikely (standard nginx static serving pattern)
**Plans**: 1 plan

Plans:
- [x] 01-01: Create multi-stage Dockerfile (build with Node, serve with nginx)

### Phase 2: CI/CD Pipeline
**Goal**: Automated build and push to DigitalOcean Container Registry on push to main
**Depends on**: Phase 1
**Research**: Unlikely (established GitHub Actions patterns with DOCR)
**Plans**: 1 plan

Plans:
- [x] 02-01: Create GitHub Actions workflow for build, push, and deploy

### Phase 3: Infrastructure Integration
**Goal**: Add phone-scanner service to docker-compose and configure nginx routing
**Depends on**: Phase 2
**Research**: Unlikely (extending existing configs with established patterns)
**Plans**: 1 plan

Plans:
- [ ] 03-01: Update docker-compose.prod.yml and nginx.prod.conf in PillRoute repo

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Containerization | 1/1 | Complete | 2026-01-11 |
| 2. CI/CD Pipeline | 1/1 | Complete | 2026-01-11 |
| 3. Infrastructure Integration | 0/1 | Not started | - |
