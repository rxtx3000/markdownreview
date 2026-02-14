# Execution Plan: MarkdownReview Hub

This document outlines the phased implementation plan for MarkdownReview Hub.

---

## Phase 0: Project Setup (Days 1–2)

### 0.1 Initialize Repository & Tooling

- [ ] Initialize Git repository with `.gitignore` (Node, Next.js, Prisma).
- [ ] Create Next.js project with TypeScript (`npx create-next-app@latest --typescript`).
- [ ] Configure ESLint + Prettier with consistent rules.
- [ ] Set up Husky pre-commit hooks for linting.

### 0.2 Docker & Database Infrastructure

- [ ] Create `Dockerfile` for Next.js production build.
- [ ] Create `docker-compose.yml` with services:
  - `app` — Next.js container.
  - `db` — PostgreSQL 16.
  - `proxy` — Nginx reverse proxy.
- [ ] Create `docker-compose.override.yml` for local development (hot reload, no TLS).
- [ ] Configure Nginx for Let's Encrypt (Certbot) with auto-renewal.
- [ ] Create `.env.example` with all required environment variables.

### 0.3 Database Schema

- [ ] Initialize Prisma (`npx prisma init`).
- [ ] Define schema in `prisma/schema.prisma`:
  - `Document` model with all fields from SPEC §4.
  - `Share` model with foreign key to Document.
  - `Comment` model with foreign keys to Document and Share.
  - `DocumentVersion` model for history snapshots.
- [ ] Create initial migration (`npx prisma migrate dev --name init`).
- [ ] Add migration script to Docker entrypoint for auto-run on startup.

**Deliverable:** `docker compose up` starts all services; Prisma migrations run automatically; empty database is ready.

---

## Phase 1: Core API — Documents (Days 3–5)

### 1.1 Authentication Middleware

- [ ] Create utility function: `hashToken(token: string): string` using SHA-256.
- [ ] Create utility function: `generateToken(): { raw: string, hash: string }`.
- [ ] Build middleware to extract token from query params (`auth` or `invite`).
- [ ] Build middleware to verify token against `Documents.owner_token_hash` or `Shares.invite_token_hash`.
- [ ] Return proper error responses: `401 INVALID_TOKEN`, `403 INSUFFICIENT_PERMISSION`.

### 1.2 Document CRUD Endpoints

- [ ] `POST /api/documents` — Create document, generate owner token, return Owner URL.
- [ ] `GET /api/documents/:id` — Retrieve document (Owner or valid Reviewer).
- [ ] `PATCH /api/documents/:id` — Update content/title/status (Owner only).
- [ ] `DELETE /api/documents/:id` — Delete document and cascade (Owner only).

### 1.3 Document Locking

- [ ] Implement `acquireLock(docId, userName)` — sets `locked_by` and `lock_expires_at`.
- [ ] Implement `releaseLock(docId)` — clears lock fields.
- [ ] Add lock check to `PATCH` — return `409 DOCUMENT_LOCKED` if locked by another user.
- [ ] Create background job or middleware to auto-expire locks after 5 minutes.

### 1.4 File Upload

- [ ] Add `POST /api/documents/upload` endpoint.
- [ ] Validate file size ≤ 5 MB; return `413 FILE_TOO_LARGE` if exceeded.
- [ ] Validate UTF-8 encoding.
- [ ] Create document from uploaded `.md` content.

**Deliverable:** Full Document CRUD via API with token auth and locking.

---

## Phase 2: Shares & Comments API (Days 6–8)

### 2.1 Shares Endpoints

- [ ] `POST /api/documents/:id/shares` — Generate reviewer link with hashed token.
- [ ] `GET /api/documents/:id/shares` — List all shares (Owner only).
- [ ] `PATCH /api/documents/:id/shares/:shareId` — Revoke (`is_active: false`) or update.
- [ ] Implement expiration check: return `410 SHARE_EXPIRED` if `expires_at` has passed.
- [ ] Implement revocation check: return `403 SHARE_REVOKED` if `is_active === false`.

### 2.2 Comments Endpoints

- [ ] `GET /api/documents/:id/comments` — List comments; support `?status=open` filter.
- [ ] `POST /api/documents/:id/comments` — Create comment with `text_anchor` and `comment_body`.
- [ ] `PATCH /api/documents/:id/comments/:commentId` — Resolve comment (Owner or author only).
- [ ] Validate that `text_anchor` JSON has required fields (`startLine`, `endLine`, `startChar`, `endChar`).

### 2.3 Token Rotation

- [ ] `POST /api/documents/:id/rotate-token` — Generate new owner token, invalidate old, return new URL.

**Deliverable:** Complete Shares and Comments API with proper authorization.

---

## Phase 3: CriticMarkup Engine (Days 9–12)

### 3.1 Remark Plugin for CriticMarkup

- [ ] Create `remark-critic-markup` plugin.
- [ ] Parse additions: `{++ text ++}` → `<ins>` with green styling.
- [ ] Parse deletions: `{-- text --}` → `<del>` with red styling.
- [ ] Parse substitutions: `{~~ old ~> new ~~}` → combined `<del>` + `<ins>`.
- [ ] Ensure plugin ignores code blocks and inline code.
- [ ] Write unit tests for all CriticMarkup patterns.

### 3.2 Change Detection API

- [ ] `GET /api/documents/:id/changes` — Parse document, extract all CriticMarkup regions with IDs.
- [ ] Return array of `{ id, type, original, replacement, position }`.

### 3.3 Accept/Reject Logic

- [ ] `POST /api/documents/:id/changes/accept` — Remove markup, keep new text.
- [ ] `POST /api/documents/:id/changes/reject` — Remove markup, keep original text.
- [ ] Support `{ change_ids: [...] }` for selective changes or `{ all: true }` for bulk.
- [ ] Create `DocumentVersion` snapshot after each accept/reject operation.
- [ ] Block direct edits if unresolved changes exist (`409 PENDING_CHANGES`).

**Deliverable:** CriticMarkup parsing, rendering, and accept/reject workflow complete.

---

## Phase 4: Frontend — Editor & Viewer (Days 13–18)

### 4.1 Page Structure

- [ ] Create route: `/` — Landing page with "Create Document" form.
- [ ] Create route: `/edit/[docId]` — Owner view.
- [ ] Create route: `/review/[docId]` — Reviewer view.
- [ ] Implement token extraction from URL query params on page load.

### 4.2 CodeMirror 6 Integration

- [ ] Install and configure CodeMirror 6 with Markdown syntax highlighting.
- [ ] Create custom extension for CriticMarkup syntax highlighting:
  - Additions: green background.
  - Deletions: red background with strikethrough.
  - Substitutions: combined styling.
- [ ] Implement auto-wrap for reviewer edits:
  - Insertions → wrap in `{++ ++}`.
  - Deletions → wrap in `{-- --}`.
  - Replacements → wrap in `{~~ ~> ~~}`.
- [ ] Handle `view_only` permission: make editor read-only.

### 4.3 Rendered Preview

- [ ] Integrate remark pipeline with CriticMarkup plugin.
- [ ] Sanitize HTML output with DOMPurify.
- [ ] Implement split-pane layout: Editor | Preview.
- [ ] Add toggle for full-screen preview mode.

### 4.4 Document Management UI (Owner)

- [ ] Display document title (editable).
- [ ] Status badge: Draft / In Review / Finalized.
- [ ] "Change Status" dropdown.
- [ ] "Delete Document" button with confirmation modal.
- [ ] "Rotate Token" button with warning about URL invalidation.

**Deliverable:** Functional editor with Markdown + CriticMarkup support and live preview.

---

## Phase 5: Frontend — Sharing & Comments (Days 19–23)

### 5.1 Share Management Panel (Owner)

- [ ] "Add Reviewer" form: name, permissions dropdown, optional expiration date.
- [ ] Display generated reviewer URL with copy button.
- [ ] List existing shares with status (active/revoked/expired).
- [ ] "Revoke" button for each share.

### 5.2 Comments Sidebar

- [ ] Display list of comments anchored to document.
- [ ] Highlight commented text ranges in editor/preview.
- [ ] Click comment → scroll to anchored position.
- [ ] "Add Comment" flow: select text → click "Comment" → enter text → submit.
- [ ] "Resolve" button (visible to Owner and comment author).
- [ ] Filter toggle: Show All / Open Only.

### 5.3 Change Review Panel (Owner)

- [ ] Display list of pending changes with type icons (add/delete/substitute).
- [ ] "Accept" and "Reject" buttons per change.
- [ ] "Accept All" / "Reject All" bulk actions.
- [ ] Visual diff: show original vs. replacement inline.

**Deliverable:** Complete sharing workflow and comment/change review UI.

---

## Phase 6: Polish & Non-Functional Requirements (Days 24–28)

### 6.1 Error Handling & UX

- [ ] Implement global error boundary with user-friendly messages.
- [ ] Display toast notifications for success/error states.
- [ ] Handle network errors gracefully with retry option.
- [ ] Show loading states for all async operations.

### 6.2 Accessibility (WCAG 2.1 AA)

- [ ] Ensure all interactive elements are keyboard navigable.
- [ ] Add ARIA labels to buttons, forms, and dynamic content.
- [ ] Test with screen reader (NVDA or VoiceOver).
- [ ] Verify colour contrast for CriticMarkup highlights (green/red on white).

### 6.3 Performance

- [ ] Optimize remark pipeline for large documents (≤ 200ms for 5 MB).
- [ ] Implement debounced saves to reduce API calls.
- [ ] Add response caching headers where appropriate.
- [ ] Lazy-load CodeMirror and heavy dependencies.

### 6.4 Security Hardening

- [ ] Set `Referrer-Policy: no-referrer` header.
- [ ] Implement rate limiting: 60 req/min authenticated, 10 req/min unauthenticated.
- [ ] Validate and sanitize all user inputs server-side.
- [ ] Ensure HTTPS redirect is enforced at Nginx level.

### 6.5 Browser Testing

- [ ] Test on Chrome (latest 2 versions).
- [ ] Test on Firefox (latest 2 versions).
- [ ] Test on Safari (latest 2 versions).
- [ ] Test on Edge (latest 2 versions).

**Deliverable:** Production-ready application meeting all non-functional requirements.

---

## Phase 7: Testing & Documentation (Days 29–32)

### 7.1 Automated Tests

- [ ] Unit tests for CriticMarkup parser (Jest/Vitest).
- [ ] Unit tests for token hashing and validation utilities.
- [ ] Integration tests for all API endpoints (Supertest or Playwright API testing).
- [ ] E2E tests for critical user flows (Playwright):
  - Create document → get Owner URL.
  - Share with reviewer → reviewer makes changes.
  - Owner accepts/rejects changes.
  - Finalize document.

### 7.2 Documentation

- [ ] Write `README.md` with:
  - Project overview.
  - Local development setup instructions.
  - Production deployment guide.
  - Environment variable reference.
- [ ] Document API endpoints (consider OpenAPI/Swagger spec).
- [ ] Add inline code comments for complex logic.

**Deliverable:** Test suite with ≥80% coverage; comprehensive documentation.

---

## Phase 8: Deployment & Launch (Days 33–35)

### 8.1 Production Environment

- [ ] Provision production server (VPS or cloud instance).
- [ ] Configure DNS for domain.
- [ ] Deploy with `docker compose up -d`.
- [ ] Verify Let's Encrypt certificates are issued.
- [ ] Test HTTPS redirect and certificate renewal.

### 8.2 Monitoring & Logging

- [ ] Configure application logging (structured JSON logs).
- [ ] Set up log aggregation (optional: Loki, ELK, or cloud logging).
- [ ] Add health check endpoint (`/api/health`).
- [ ] Configure uptime monitoring (optional: UptimeRobot, Healthchecks.io).

### 8.3 Launch Checklist

- [ ] Verify all SPEC.md requirements are met.
- [ ] Perform manual smoke test of all features.
- [ ] Back up database (verify backup/restore process).
- [ ] Announce launch / share with initial users.

**Deliverable:** Live production deployment accessible via HTTPS.

---

## Summary Timeline

| Phase | Description                   | Duration | Cumulative |
| ----- | ----------------------------- | -------- | ---------- |
| 0     | Project Setup                 | 2 days   | Day 2      |
| 1     | Core API — Documents          | 3 days   | Day 5      |
| 2     | Shares & Comments API         | 3 days   | Day 8      |
| 3     | CriticMarkup Engine           | 4 days   | Day 12     |
| 4     | Frontend — Editor & Viewer    | 6 days   | Day 18     |
| 5     | Frontend — Sharing & Comments | 5 days   | Day 23     |
| 6     | Polish & NFRs                 | 5 days   | Day 28     |
| 7     | Testing & Documentation       | 4 days   | Day 32     |
| 8     | Deployment & Launch           | 3 days   | Day 35     |

**Total Estimated Duration: 35 working days (~7 weeks)**

---

## Risk Mitigation

| Risk                              | Likelihood | Impact | Mitigation                                                         |
| --------------------------------- | ---------- | ------ | ------------------------------------------------------------------ |
| CriticMarkup edge cases           | Medium     | High   | Extensive unit tests; handle nested/malformed markup gracefully    |
| CodeMirror integration complexity | Medium     | Medium | Prototype early in Phase 4; fallback to simpler textarea if needed |
| Performance on large documents    | Low        | High   | Benchmark early; consider Web Workers for parsing                  |
| Let's Encrypt rate limits         | Low        | Medium | Test with staging certificates first; use DNS challenge if needed  |
