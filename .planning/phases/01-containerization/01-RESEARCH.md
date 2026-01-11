# Phase 1: Containerization - Research

**Researched:** 2026-01-11
**Domain:** Multi-stage Docker build for Vite React PWA with nginx
**Confidence:** HIGH

<research_summary>
## Summary

Researched the standard pattern for containerizing a Vite/React PWA for production deployment. The established approach uses a two-stage Docker build: Node.js Alpine for building, nginx Alpine for serving.

Key finding: PWA cache headers are critical. Service worker and index.html must NOT be cached (max-age=0), while hashed assets in `/assets/` and workbox files should be cached indefinitely (immutable). This ensures updates propagate correctly.

**Primary recommendation:** Use multi-stage Dockerfile with node:20-alpine for build, nginx:alpine for serving. Include PWA-optimized nginx.conf with proper cache headers for service worker, manifest, and hashed assets.
</research_summary>

<standard_stack>
## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node | 20-alpine | Build environment | LTS, matches project |
| nginx | stable-alpine | Static file serving | Industry standard, tiny image |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| npm ci | Deterministic install | Always in CI/Docker |
| vite build | Production bundling | Build stage |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| nginx | caddy | Caddy auto-SSL, but nginx already used in infra |
| nginx | serve | Simpler but less production-ready |

**Installation:**
Not applicable - base images are pulled.
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Dockerfile Structure
```dockerfile
# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Serve
FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Pattern 1: PWA-Optimized nginx.conf
**What:** Cache headers differentiated by file type for PWA correctness
**When to use:** Any PWA with service worker
**Example:**
```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    # Hashed assets - cache indefinitely
    location ^~ /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
    }

    # Workbox scripts - cache indefinitely
    location ^~ /workbox- {
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
    }

    # Root, SW, manifest - no cache
    location / {
        add_header Cache-Control "public, max-age=0, must-revalidate" always;
        try_files $uri /index.html;
    }
}
```

### Pattern 2: SPA Client-Side Routing
**What:** try_files directive falls back to index.html
**When to use:** All React SPAs
**Example:**
```nginx
try_files $uri /index.html;
```

### Anti-Patterns to Avoid
- **Caching service-worker.js:** Browsers may not update for 24 hours
- **Caching index.html:** Prevents app updates from propagating
- **Not using try_files:** 404s on direct URL access or refresh
- **Running as root:** Security risk, use nginx user
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Static file serving | Custom Node server | nginx | nginx is faster, more battle-tested |
| Gzip compression | Custom compression | nginx gzip module | Built-in, optimized |
| PWA manifest handling | Custom MIME config | nginx mime.types | Standard mapping exists |
| Service worker caching | Custom cache logic | vite-plugin-pwa workbox | Already configured in project |

**Key insight:** The vite-plugin-pwa already handles service worker generation with workbox. nginx just needs correct cache headers to let workbox do its job.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Service Worker Not Updating
**What goes wrong:** Users stuck on old version of app
**Why it happens:** Service-worker.js cached with long max-age
**How to avoid:** Set Cache-Control: max-age=0, must-revalidate for sw.js
**Warning signs:** Users report stale content, no updates visible

### Pitfall 2: 404 on Refresh
**What goes wrong:** Direct URL access returns 404
**Why it happens:** nginx looking for /some/path file instead of serving index.html
**How to avoid:** Use try_files $uri /index.html
**Warning signs:** Works on navigation but 404 on refresh

### Pitfall 3: Large Image Size
**What goes wrong:** 1GB+ Docker image
**Why it happens:** Using full node image, not cleaning up, single stage
**How to avoid:** Multi-stage build, alpine images, .dockerignore
**Warning signs:** Slow deploys, high registry storage

### Pitfall 4: Container Port Mismatch
**What goes wrong:** Can't connect to container
**Why it happens:** nginx listening on 80 but container expects different port
**How to avoid:** Standard port 80 in Dockerfile, map externally as needed
**Warning signs:** Connection refused errors
</common_pitfalls>

<code_examples>
## Code Examples

### Complete Production Dockerfile
```dockerfile
# Source: Standard multi-stage pattern for Vite PWA
# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production
FROM nginx:stable-alpine
# Copy custom nginx config with PWA cache headers
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Complete nginx.conf for PWA
```nginx
# Source: vite-pwa-org.netlify.app/deployment/nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/manifest+json;

    # Hashed assets - cache 1 year (immutable)
    location ^~ /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
    }

    # Workbox scripts - cache 1 year
    location ^~ /workbox- {
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
    }

    # Service worker - never cache
    location = /sw.js {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        try_files $uri =404;
    }

    # Manifest - short cache
    location = /manifest.webmanifest {
        add_header Cache-Control "public, max-age=0, must-revalidate";
        try_files $uri =404;
    }

    # All other files - check existence, fallback to index.html for SPA routing
    location / {
        add_header Cache-Control "public, max-age=0, must-revalidate" always;
        try_files $uri /index.html;
    }
}
```

### .dockerignore
```
node_modules
dist
.git
.gitignore
*.md
.env*
```
</code_examples>

<sota_updates>
## State of the Art (2025-2026)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-stage Dockerfile | Multi-stage builds | 2018+ | Much smaller images, 10x+ reduction |
| node:latest | node:20-alpine | Ongoing | Smaller, faster, more secure |
| Manual service worker | vite-plugin-pwa | 2022+ | Already using, no change needed |

**New tools/patterns to consider:**
- **Brotli compression:** nginx supports brotli via module, ~20% better than gzip
- **WebP/AVIF:** Not applicable (no images in this app)

**Deprecated/outdated:**
- **CRA (Create React App):** Project uses Vite, which is correct
- **http-server/serve:** Not production-grade, use nginx
</sota_updates>

<open_questions>
## Open Questions

None - this is a well-understood commodity pattern with clear best practices.
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- [Vite PWA nginx deployment](https://vite-pwa-org.netlify.app/deployment/nginx) - Cache header configuration
- [DEV Community: Multi-stage nginx build](https://dev.to/it-wibrc/guide-to-containerizing-a-modern-javascript-spa-vuevitereact-with-a-multi-stage-nginx-build-1lma) - Dockerfile pattern

### Secondary (MEDIUM confidence)
- Existing PillRoute docker-compose.prod.yml - Infrastructure pattern verification
- Existing PillRoute nginx.prod.conf - Nginx configuration patterns

### Tertiary (LOW confidence - needs validation)
- None - all patterns verified
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: Docker multi-stage builds
- Ecosystem: nginx, node alpine images
- Patterns: PWA cache headers, SPA routing
- Pitfalls: Service worker caching, 404 on refresh

**Confidence breakdown:**
- Standard stack: HIGH - industry standard pattern
- Architecture: HIGH - verified with official vite-pwa docs
- Pitfalls: HIGH - well-documented in community
- Code examples: HIGH - from authoritative sources

**Research date:** 2026-01-11
**Valid until:** 2026-07-11 (6 months - stable technology)
</metadata>

---

*Phase: 01-containerization*
*Research completed: 2026-01-11*
*Ready for planning: yes*
