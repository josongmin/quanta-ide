# ADR-0006: Content Security Policy Hardening

**Status:** Accepted  
**Date:** 2026-04-15  
**Deciders:** Song Min

## Context

The Tauri desktop app (`p0-ide/src-tauri/tauri.conf.json`) ships a Content Security Policy that controls which resources the WebView can load. The previous CSP had two weaknesses:

1. **External origins allowed** -- `https://fonts.googleapis.com` and `https://fonts.gstatic.com` were permitted in `style-src` and `font-src`. A desktop IDE should bundle all assets locally; allowing external origins expands the attack surface (DNS hijack, CDN compromise, exfiltration vector via font request).
2. **Missing deny directives** -- `object-src`, `frame-src`, `base-uri`, and `form-action` were unspecified, inheriting from `default-src 'self'` where applicable. Explicit `'none'` is stronger because it survives future `default-src` edits and makes intent clear to auditors.

## Decision

Replace the CSP with the following hardened policy:

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
font-src 'self' data:;
img-src 'self' asset: https://asset.localhost blob: data:;
connect-src 'self' ipc: http://ipc.localhost https://ipc.localhost ws://localhost:* http://localhost:*;
object-src 'none';
frame-src 'none';
base-uri 'self';
form-action 'none';
```

## Directive-by-directive rationale

| Directive | Value | Why |
|-----------|-------|-----|
| `default-src` | `'self'` | Baseline: only load resources from the app origin |
| `script-src` | `'self'` | No inline scripts, no `eval()`, no external scripts. Blocks XSS via script injection |
| `style-src` | `'self' 'unsafe-inline'` | `'unsafe-inline'` required: Vite injects `<style>` tags in dev, React uses inline `style={}` for dynamic values. Acceptable trade-off (see below) |
| `font-src` | `'self' data:` | Local fonts only. `data:` for base64-encoded icon fonts. Removed external Google Fonts origins |
| `img-src` | `'self' asset: https://asset.localhost blob: data:` | `asset:`/`https://asset.localhost` for Tauri asset protocol. `blob:` for canvas exports and dynamic image generation. `data:` for inline SVG/PNG |
| `connect-src` | `'self' ipc: http://ipc.localhost https://ipc.localhost ws://localhost:* http://localhost:*` | `ipc:`/`http(s)://ipc.localhost` for Tauri IPC. `ws://localhost:*`/`http://localhost:*` for Vite HMR and dev server. `'self'` for same-origin fetch. No external API endpoints permitted |
| `object-src` | `'none'` | No Flash, Java applets, or plugin embeds. Blocks legacy plugin-based attacks |
| `frame-src` | `'none'` | No iframes. The IDE renders all content directly; no embedded external pages |
| `base-uri` | `'self'` | Prevents `<base href>` injection that could redirect all relative URLs |
| `form-action` | `'none'` | No HTML form submissions. The app uses fetch/IPC exclusively; blocks form-based CSRF |

## What changed from the previous CSP

| Change | Before | After | Rationale |
|--------|--------|-------|-----------|
| Google Fonts removed | `style-src` included `https://fonts.googleapis.com`; `font-src` included `https://fonts.gstatic.com` | Removed | Fonts must be bundled locally. External origins are an unnecessary attack surface for a desktop app |
| `blob:` added to `img-src` | Not present | `blob:` | Canvas `toBlob()` and `URL.createObjectURL()` for dynamic images |
| `data:` added to `font-src` | Not present | `data:` | Base64-encoded icon font subsets |
| `'self'` added to `connect-src` | Not present | `'self'` | Explicit same-origin fetch (defense-in-depth alongside IPC schemes) |
| `https://ipc.localhost` added | Not present | `https://ipc.localhost` | Tauri v2 may use HTTPS scheme for IPC depending on platform |
| `object-src 'none'` added | Inherited `default-src` | Explicit `'none'` | Blocks plugin/embed content explicitly |
| `frame-src 'none'` added | Inherited `default-src` | Explicit `'none'` | Blocks iframe embedding explicitly |
| `base-uri 'self'` added | Unset | `'self'` | Prevents base-tag hijacking |
| `form-action 'none'` added | Unset | `'none'` | Prevents form-based exfiltration |

## Trade-offs accepted

### `'unsafe-inline'` in `style-src`

This is the only relaxation from a maximally strict policy. It is required because:

- **Vite dev server** injects CSS via `<style>` tags for HMR
- **React** applies dynamic styles via `style={}` attributes (e.g., overlay positioning, animation offsets)
- **CSS-in-JS patterns** in the codebase use inline style injection

Mitigation: `script-src` does NOT include `'unsafe-inline'`, so an attacker cannot escalate style injection into script execution. Style-only injection is limited to UI defacement, which is low-severity in a local desktop context.

### `ws://localhost:*` and `http://localhost:*` in `connect-src`

These are needed for Vite dev server (HMR websocket, asset fetching). In production builds, Tauri serves from `tauri://localhost` and these localhost origins are unused. Tauri's production build process does not strip CSP directives, but the origins are unreachable in production context (no localhost server running).

Future improvement: consider environment-conditional CSP if Tauri adds build-time CSP templating.

### No `'unsafe-eval'`

Intentionally absent from all directives. This blocks `eval()`, `Function()`, `setTimeout(string)`, and `setInterval(string)`. None of these are used in the codebase. This is the single most important XSS mitigation after blocking inline scripts.

## Consequences

### Positive

- External font CDN dependency eliminated (faster startup, no network dependency, no DNS leak)
- Plugin/embed/iframe/form attack vectors explicitly closed
- Base-tag hijacking prevented
- Policy is auditable: every directive is documented with rationale
- No `'unsafe-eval'` anywhere in the policy

### Negative

- Fonts previously loaded from Google Fonts must be bundled in the app assets (already the case for p0-ide-v2)
- `'unsafe-inline'` for styles remains a theoretical vector for UI defacement (not escalatable to script execution)
- Dev-mode `ws://localhost:*` is broader than necessary (cannot scope to exact port without breaking multi-instance dev)
