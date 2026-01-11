# Technology Stack

**Analysis Date:** 2026-01-11

## Languages

**Primary:**
- TypeScript 5.6.2 - All application code (`tsconfig.json`, `package.json`)

**Secondary:**
- JavaScript - Build configuration files (`vite.config.ts`, `postcss.config.js`)

## Runtime

**Environment:**
- Node.js (npm-based project)
- Target Runtime: Browser (Web/PWA - ES2020)
- Module System: ES Modules (`"type": "module"` in `package.json`)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- React 18.3.1 - UI framework (`src/App.tsx`, `src/main.tsx`)
- React DOM 18.3.1 - DOM rendering

**Testing:**
- None configured

**Build/Dev:**
- Vite 6.0.3 - Build tool and dev server (`vite.config.ts`)
- TypeScript ~5.6.2 - Type checking and compilation
- PostCSS 8.4.49 - CSS post-processing (`postcss.config.js`)
- Autoprefixer 10.4.20 - Browser prefix handling

## Key Dependencies

**Critical:**
- barcode-detector 2.2.8 - Barcode/QR code detection (`src/hooks/useBarcodeScanner.ts`)
- vite-plugin-pwa 0.21.1 - PWA support with service worker (`vite.config.ts`, `src/main.tsx`)

**Styling:**
- Tailwind CSS 3.4.17 - Utility-first CSS framework (`tailwind.config.js`)

**Type Definitions:**
- @types/react 18.3.12
- @types/react-dom 18.3.1

## Configuration

**Environment:**
- Vite environment system (`import.meta.env`)
- `VITE_API_URL` - Backend API URL (defaults to `https://api.quickprx.com`)
- Type declarations in `src/vite-env.d.ts`

**Build:**
- `tsconfig.json` - TypeScript compiler options (strict mode, ES2020 target)
- `vite.config.ts` - Vite bundler + React + PWA plugins
- `tailwind.config.js` - Tailwind CSS with dark mode support
- `postcss.config.js` - PostCSS with Tailwind and Autoprefixer

## Platform Requirements

**Development:**
- Any platform with Node.js
- No external dependencies required

**Production:**
- Modern mobile browsers (iOS Safari, Chrome Android)
- Installable as PWA (standalone mode)
- Camera access required for barcode scanning
- WebSocket support for real-time communication

---

*Stack analysis: 2026-01-11*
*Update after major dependency changes*
