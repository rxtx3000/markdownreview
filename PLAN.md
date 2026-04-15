# Execution Plan: MarkdownReview Hub

This document outlines the phased implementation plan for MarkdownReview Hub.

---

## Phase 0: Project Setup (Days 1–2)

### 0.1 Initialize Repository & Tooling

- [x] Initialize Git repository with `.gitignore` (Node, Next.js, Prisma).
- [x] Create Next.js project with TypeScript (`npx create-next-app@latest --typescript`).
- [x] Configure ESLint + Prettier with consistent rules.
- [x] Set up Husky pre-commit hooks for linting.

### 0.2 Docker & Database Infrastructure

- [x] Create `Dockerfile` for Next.js production build.
- [x] Create `docker-compose.yml` with services:
  - `app` — Next.js container.
  - `db` — PostgreSQL 16.
- [x] Create `docker-compose.override.yml` for local development (hot reload, port mapping).
- [x] Create `.env.example` with all required environment variables.

### 0.3 Database Schema

- [x] Initialize Prisma (`npx prisma init`).
- [x] Define schema in `prisma/schema.prisma`:
  - `Document` model with all fields from SPEC §4.
  - `Share` model with foreign key to Document.
  - `Comment` model with foreign keys to Document and Share.
  - `DocumentVersion` model for history snapshots.
- [x] Create initial migration (`npx prisma migrate dev --name init`).
- [x] Add migration script to Docker entrypoint for auto-run on startup.

**Deliverable:** `docker compose up` starts all services; Prisma migrations run automatically; empty database is ready.

---

## Phase 1: Core API — Documents (Days 3–5)

### 1.1 Authentication Middleware

- [x] Create utility function: `hashToken(token: string): string` using SHA-256.
- [x] Create utility function: `generateToken(): { raw: string, hash: string }`.
- [x] Build middleware to extract token from query params (`auth` or `invite`).
- [x] Build middleware to verify token against `Documents.owner_token_hash` or `Shares.invite_token_hash`.
- [x] Return proper error responses: `401 INVALID_TOKEN`, `403 INSUFFICIENT_PERMISSION`.

### 1.2 Document CRUD Endpoints

- [x] `POST /api/documents` — Create document, generate owner token, return Owner URL.
- [x] `GET /api/documents/:id` — Retrieve document (Owner or valid Reviewer).
- [x] `PATCH /api/documents/:id` — Update content/title/status (Owner only).
- [x] `DELETE /api/documents/:id` — Delete document and cascade (Owner only).

### 1.3 Document Locking

- [x] Implement `acquireLock(docId, userName)` — sets `locked_by` and `lock_expires_at`.
- [x] Implement `releaseLock(docId)` — clears lock fields.
- [x] Add lock check to `PATCH` — return `409 DOCUMENT_LOCKED` if locked by another user.
- [x] Create background job or middleware to auto-expire locks after 5 minutes.

### 1.4 File Upload

- [x] Add `POST /api/documents/upload` endpoint.
- [x] Read max file size from `MAX_UPLOAD_SIZE_MB` environment variable (default: 5 MB).
- [x] Validate file size ≤ configured limit; return `413 FILE_TOO_LARGE` if exceeded.
- [x] Validate UTF-8 encoding.
- [x] Create document from uploaded `.md` content.
- [x] Update `src/lib/auth/errors.ts` — `fileTooLarge` to accept size parameter for dynamic error message.
- [x] Add `MAX_UPLOAD_SIZE_MB` to `.env.example` with documentation.

**Deliverable:** Full Document CRUD via API with token auth and locking.

---

## Phase 2: Shares & Comments API (Days 6–8)

### 2.1 Shares Endpoints

- [x] `POST /api/documents/:id/shares` — Generate reviewer link with hashed token.
- [x] `GET /api/documents/:id/shares` — List all shares (Owner only).
- [x] `PATCH /api/documents/:id/shares/:shareId` — Revoke (`is_active: false`) or update.
- [x] Implement expiration check: return `410 SHARE_EXPIRED` if `expires_at` has passed.
- [x] Implement revocation check: return `403 SHARE_REVOKED` if `is_active === false`.

### 2.2 Comments Endpoints

- [x] `GET /api/documents/:id/comments` — List comments; support `?status=open` filter.
- [x] `POST /api/documents/:id/comments` — Create comment with `text_anchor` and `comment_body`.
- [x] `PATCH /api/documents/:id/comments/:commentId` — Resolve comment (Owner or author only).
- [x] Validate that `text_anchor` JSON has required fields (`startLine`, `endLine`, `startChar`, `endChar`).

### 2.3 Token Rotation

- [x] `POST /api/documents/:id/rotate-token` — Generate new owner token, invalidate old, return new URL.

**Deliverable:** Complete Shares and Comments API with proper authorization.

---

## Phase 3: CriticMarkup Engine (Days 9–12)

### 3.1 Remark Plugin for CriticMarkup

- [x] Create `remark-critic-markup` plugin.
- [x] Parse additions: `{++ text ++}` → `<ins>` with green styling.
- [x] Parse deletions: `{-- text --}` → `<del>` with red styling.
- [x] Parse substitutions: `{~~ old ~> new ~~}` → combined `<del>` + `<ins>`.
- [x] Ensure plugin ignores code blocks and inline code.
- [x] Write unit tests for all CriticMarkup patterns.

### 3.2 Change Detection API

- [x] `GET /api/documents/:id/changes` — Parse document, extract all CriticMarkup regions with IDs.
- [x] Return array of `{ id, type, original, replacement, position }`.

### 3.3 Accept/Reject Logic

- [x] `POST /api/documents/:id/changes/accept` — Remove markup, keep new text.
- [x] `POST /api/documents/:id/changes/reject` — Remove markup, keep original text.
- [x] Support `{ change_ids: [...] }` for selective changes or `{ all: true }` for bulk.
- [x] Create `DocumentVersion` snapshot after each accept/reject operation.
- [x] Block direct edits if unresolved changes exist (`409 PENDING_CHANGES`).

**Deliverable:** CriticMarkup parsing, rendering, and accept/reject workflow complete.

---

## Phase 4: Frontend — Editor & Viewer (Days 13–18)

### 4.1 Page Structure

- [x] Create route: `/` — Landing page with "Create Document" form.
- [x] Create route: `/edit/[docId]` — Owner view.
- [x] Create route: `/review/[docId]` — Reviewer view.
- [x] Implement token extraction from URL query params on page load.

### 4.2 CodeMirror 6 Integration

- [x] Install and configure CodeMirror 6 with Markdown syntax highlighting.
- [x] Create custom extension for CriticMarkup syntax highlighting:
  - Additions: green background.
  - Deletions: red background with strikethrough.
  - Substitutions: combined styling.
- [x] Implement auto-wrap for reviewer edits:
  - Insertions → wrap in `{++ ++}`.
  - Deletions → wrap in `{-- --}`.
  - Replacements → wrap in `{~~ ~> ~~}`.
- [x] Handle `view_only` permission: make editor read-only.

### 4.3 Rendered Preview

- [x] Integrate remark pipeline with CriticMarkup plugin.
- [x] Sanitize HTML output with DOMPurify.
- [x] Implement split-pane layout: Editor | Preview.
- [x] Add toggle for full-screen preview mode.
- [x] Add GFM table rendering support via `remark-gfm`.
- [x] Add Mermaid diagram rendering for ` ```mermaid ` code blocks.

### 4.4 Document Management UI (Owner)

- [x] Display document title (editable).
- [x] Status badge: Draft / In Review / Finalized.
- [x] "Change Status" dropdown.
- [x] "Delete Document" button with confirmation modal.
- [x] "Rotate Token" button with warning about URL invalidation.

**Deliverable:** Functional editor with Markdown + CriticMarkup support and live preview.

---

## Phase 5: Frontend — Sharing & Comments (Days 19–23)

### 5.1 Share Management Panel (Owner)

- [x] "Add Reviewer" form: name, permissions dropdown, optional expiration date.
- [x] Display generated reviewer URL with copy button.
- [x] List existing shares with status (active/revoked/expired).
- [x] "Revoke" button for each share.

### 5.2 Comments Sidebar

- [x] Display list of comments anchored to document.
- [x] Highlight commented text ranges in editor/preview.
- [x] Click comment → scroll to anchored position.
- [x] "Add Comment" flow: select text → click "Comment" → enter text → submit.
- [x] "Resolve" button (visible to Owner and comment author).
- [x] Filter toggle: Show All / Open Only.

### 5.3 Change Review Panel (Owner)

- [x] Display list of pending changes with type icons (add/delete/substitute).
- [x] "Accept" and "Reject" buttons per change.
- [x] "Accept All" / "Reject All" bulk actions.
- [x] Visual diff: show original vs. replacement inline.

**Deliverable:** Complete sharing workflow and comment/change review UI.

---

## Phase 6: Version History & Comparison (Days 24–27)

### 6.1 Version API & Tracking

- [ ] `GET /api/documents/:id/versions` — List all versions with metadata (number, date, summary).
- [ ] `GET /api/documents/:id/versions/:version_number` — Retrieve specific version content and active comments.
- [ ] Ensure automatic snapshot creation on manual saves and change approvals increments `version_number`.

### 6.2 Version History UI

- [ ] Create "Version History" panel to list, select and browse previous versions.
- [ ] Render specific old versions in read-only state, correctly displaying past comments.

### 6.3 Side-by-Side Comparison & Diffing

- [ ] Implement text diffing utility to detect and highlight changes from the anterior version.
- [ ] Build dual-pane view to load and visually compare any two arbitrary versions side-by-side.

---

## Phase 7: Polish & Non-Functional Requirements (Days 28–32)

### 7.1 Error Handling & UX

- [x] Implement global error boundary with user-friendly messages.
- [x] Display toast notifications for success/error states.
- [x] Handle network errors gracefully with retry option.
- [x] Show loading states for all async operations.

### 7.2 Accessibility (WCAG 2.1 AA)

- [x] Ensure all interactive elements are keyboard navigable.
- [x] Add ARIA labels to buttons, forms, and dynamic content.
- [ ] Test with screen reader (NVDA or VoiceOver). _(Skipped: Requires manual testing with screen reader software)_
- [x] Verify colour contrast for CriticMarkup highlights (green/red on white).

### 7.3 Performance

- [ ] Optimize remark pipeline for large documents (≤ 200ms for max configured file size).
- [ ] Implement debounced saves to reduce API calls.
- [ ] Add response caching headers where appropriate.
- [ ] Lazy-load CodeMirror and heavy dependencies.

### 7.4 Security Hardening

- [ ] Set `Referrer-Policy: no-referrer` header.
- [ ] Implement rate limiting: 60 req/min authenticated, 10 req/min unauthenticated.
- [ ] Validate and sanitize all user inputs server-side.

### 7.5 Browser Testing

- [ ] Test on Chrome (latest 2 versions).
- [ ] Test on Firefox (latest 2 versions).
- [ ] Test on Safari (latest 2 versions).
- [ ] Test on Edge (latest 2 versions).

**Deliverable:** Production-ready application meeting all non-functional requirements.

---

## Phase 8: Testing & Documentation (Days 33–36)

### 8.1 Automated Tests

- [ ] Unit tests for CriticMarkup parser (Jest/Vitest).
- [ ] Unit tests for token hashing and validation utilities.
- [ ] Integration tests for all API endpoints (Supertest or Playwright API testing).
- [ ] E2E tests for critical user flows (Playwright):
  - Create document → get Owner URL.
  - Share with reviewer → reviewer makes changes.
  - Owner accepts/rejects changes.
  - Finalize document.

### 8.2 Documentation

- [ ] Write `README.md` with:
  - Project overview.
  - Local development setup instructions.
  - Production deployment guide.
  - Environment variable reference.
- [ ] Document API endpoints (consider OpenAPI/Swagger spec).
- [ ] Add inline code comments for complex logic.

**Deliverable:** Test suite with ≥80% coverage; comprehensive documentation.

---

## Phase 9: Deployment & Launch (Days 37–39)

### 9.1 Production Environment

- [ ] Provision production server (VPS or cloud instance).
- [ ] Configure DNS for domain (optional).
- [ ] Deploy with `docker compose up -d`.
- [ ] Verify application is accessible on port 3000.

### 9.2 Monitoring & Logging

- [ ] Configure application logging (structured JSON logs).
- [ ] Set up log aggregation (optional: Loki, ELK, or cloud logging).
- [ ] Add health check endpoint (`/api/health`).
- [ ] Configure uptime monitoring (optional: UptimeRobot, Healthchecks.io).

### 9.3 Launch Checklist

- [ ] Verify all SPEC.md requirements are met.
- [ ] Perform manual smoke test of all features.
- [ ] Back up database (verify backup/restore process).
- [ ] Announce launch / share with initial users.

**Deliverable:** Live production deployment accessible via HTTP (use external reverse proxy for HTTPS).

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
| 6     | Version History & Comparison  | 4 days   | Day 27     |
| 7     | Polish & NFRs                 | 5 days   | Day 32     |
| 8     | Testing & Documentation       | 4 days   | Day 36     |
| 9     | Deployment & Launch           | 3 days   | Day 39     |

**Total Estimated Duration: 39 working days (~8 weeks)**

---

## Risk Mitigation

| Risk                              | Likelihood | Impact | Mitigation                                                         |
| --------------------------------- | ---------- | ------ | ------------------------------------------------------------------ |
| CriticMarkup edge cases           | Medium     | High   | Extensive unit tests; handle nested/malformed markup gracefully    |
| CodeMirror integration complexity | Medium     | Medium | Prototype early in Phase 4; fallback to simpler textarea if needed |
| Performance on large documents    | Low        | High   | Benchmark early; consider Web Workers for parsing                  |
