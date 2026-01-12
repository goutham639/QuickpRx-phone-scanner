# QuickpRx Phone Scanner Deployment

## What This Is

A fully deployable production solution for the QuickpRx Phone Scanner PWA. Push to main triggers automatic deployment to scanner.quickprx.com via GitHub Actions, Docker, and nginx integration with the PillRoute infrastructure.

## Core Value

Fast CI/CD pipeline — push to main triggers automatic deployment to production within minutes.

## Requirements

### Validated

- ✓ React PWA with barcode scanning capability — existing
- ✓ WebSocket-based real-time communication — existing
- ✓ Mobile-first responsive design — existing
- ✓ PWA with offline support — existing
- ✓ Dockerfile for containerized deployment — v1.0
- ✓ GitHub Actions workflow for CI/CD — v1.0
- ✓ Integration with docker-compose.prod.yml (PillRoute) — v1.0
- ✓ Nginx configuration for scanner.quickprx.com subdomain — v1.0
- ✓ WebSocket handler for scan.confirmed/scan.error responses — v1.0

### Active

(None — v1.0 complete)

### Out of Scope

- Staging environment — just production for v1
- Monitoring/alerting setup — no Prometheus/Grafana
- Rollback automation — manual rollback acceptable

## Context

**Current State (v1.0 shipped):**
- ~1000 lines of TypeScript
- Tech stack: React 18, Vite 6, TypeScript, nginx
- Deployed to scanner.quickprx.com via DOCR + GitHub Actions

**Existing Infrastructure:**
- DigitalOcean Container Registry: registry.digitalocean.com/pillroute-01/
- Deployment target: DigitalOcean Droplet
- Shared nginx reverse proxy with other quickprx services
- Wildcard SSL certificate for *.quickprx.com already in place

**Files Updated:**
- `/Users/gautampaladugu/Downloads/PillRoute/docker-compose.prod.yml` — phone-scanner service added
- `/Users/gautampaladugu/Downloads/PillRoute/deploy/nginx/nginx.prod.conf` — scanner.quickprx.com server block added

## Constraints

- **Registry**: Must use DigitalOcean Container Registry (DOCR) via GitHub secrets
- **Deployment**: SSH to existing Droplet, docker-compose pull/up
- **SSL**: Use existing wildcard certificate at /etc/nginx/ssl/
- **Pattern**: Follow existing frontend service pattern (admin-portal, pharmacist-portal)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use DOCR not Docker Hub | Existing infrastructure uses DOCR | ✓ Good |
| Static nginx container | SPA needs only static file serving | ✓ Good |
| Shared nginx config | Integrate with existing reverse proxy | ✓ Good |
| Keep optimistic feedback | Error toast only when server rejects | ✓ Good |

---
*Last updated: 2026-01-12 after v1.0 milestone*
