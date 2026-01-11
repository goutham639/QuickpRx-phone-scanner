# QuickpRx Phone Scanner Deployment

## What This Is

A fully deployable production solution for the QuickpRx Phone Scanner PWA. This project adds CI/CD pipeline, Docker containerization, and integration with the existing PillRoute infrastructure to enable automatic deployment to scanner.quickprx.com on push to main.

## Core Value

Fast CI/CD pipeline — push to main triggers automatic deployment to production within minutes.

## Requirements

### Validated

- ✓ React PWA with barcode scanning capability — existing
- ✓ WebSocket-based real-time communication — existing
- ✓ Mobile-first responsive design — existing
- ✓ PWA with offline support — existing

### Active

- [x] Dockerfile for containerized deployment
- [x] GitHub Actions workflow for CI/CD
- [x] Integration with docker-compose.prod.yml (PillRoute)
- [x] Nginx configuration for scanner.quickprx.com subdomain

### Out of Scope

- Staging environment — just production for v1
- Monitoring/alerting setup — no Prometheus/Grafana
- Rollback automation — manual rollback acceptable

## Context

**Existing Infrastructure:**
- DigitalOcean Container Registry: registry.digitalocean.com/pillroute-01/
- Deployment target: DigitalOcean Droplet
- Shared nginx reverse proxy with other quickprx services
- Wildcard SSL certificate for *.quickprx.com already in place

**Codebase:**
- React 18 + Vite 6 + TypeScript
- Static SPA (no backend in this repo)
- Build command: `npm run build` → outputs to `dist/`
- Similar to existing admin-portal and pharmacist-portal deployments

**Files to Update:**
- `/Users/gautampaladugu/Downloads/PillRoute/docker-compose.prod.yml` — add phone-scanner service
- `/Users/gautampaladugu/Downloads/PillRoute/deploy/nginx/nginx.prod.conf` — add scanner.quickprx.com server block

## Constraints

- **Registry**: Must use DigitalOcean Container Registry (DOCR) via GitHub secrets
- **Deployment**: SSH to existing Droplet, docker-compose pull/up
- **SSL**: Use existing wildcard certificate at /etc/nginx/ssl/
- **Pattern**: Follow existing frontend service pattern (admin-portal, pharmacist-portal)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use DOCR not Docker Hub | Existing infrastructure uses DOCR | ✓ Implemented |
| Static nginx container | SPA needs only static file serving | ✓ Implemented |
| Shared nginx config | Integrate with existing reverse proxy | ✓ Implemented |

---
*Last updated: 2026-01-11 — All phases complete*
