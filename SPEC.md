# Project Specification: MarkdownReview Hub

## 1. Executive Summary

MarkdownReview Hub is a web-based collaboration tool designed for reviewing and editing Markdown documents. Unlike traditional word processors, it focuses on "code-like" review workflows, allowing owners to share unique access links with reviewers to track changes and leave comments without requiring complex version control knowledge (like Git).

---

## 2. Core Functional Requirements

### A. Document Management

- **Create/Upload:** Users can create a new document via a text editor or by uploading a `.md` file.
  - **Upload Constraints:** Files must be UTF-8 encoded and not exceed **5 MB** in size. The server must reject uploads that exceed this limit with an appropriate error message.
- **Ownership & Deletion:** The creator is designated as the "Owner." Only the Owner has the permission to permanently delete a document.
- **Document Lifecycle:** Each document has a `status` field that tracks its current stage:
  - `draft` — Initial state after creation; only the Owner can view and edit.
  - `in_review` — The Owner has shared the document with at least one reviewer; reviewers can access it.
  - `finalized` — The Owner has closed the review; all reviewer links become read-only. No further suggestions are accepted.
- **Dual-View Mode:**
  - **Editor View:** A raw text editor with syntax highlighting for Markdown.
  - **Rendered View:** A live-preview mode showing the document as formatted HTML.

### B. Review & Tracking System

- **Track Changes:** The application must capture edits (additions, deletions, and substitutions).
  - _Implementation:_ Utilize a **subset of CriticMarkup** syntax to store changes directly in the text. The supported operations are:
    - **Additions:** `{++ added text ++}`
    - **Deletions:** `{-- deleted text --}`
    - **Substitutions:** `{~~ original text ~> replacement text ~~}`
  - The following CriticMarkup constructs are **out of scope** for v1: highlights (`{== ==}`) and inline CriticMarkup comments (`{>> <<}`). These may be considered in future iterations.
- **Owner Edit Protection:** When a document contains unresolved CriticMarkup tags, the Owner must **accept or reject all pending changes** before making direct edits to the source. This prevents corruption of inline markup.

- **Commenting:**
  - Ability to highlight text and attach a sidebar comment.
  - Comments must be anchored to specific lines or character ranges.
  - Reviewers with `view_only` permission may still create comments (see §2C).
  - Comments support a `status` of `open` or `resolved`. The Owner or the comment author can mark a comment as resolved.
  - Comments are immutable after creation (no editing). If a correction is needed, the author should resolve the original and create a new comment.

### C. Access & Sharing Logic

The system uses a **Token-Based Access** model. No account is required for reviewers if they have a valid unique link.

- **Token Architecture:** A raw token (UUID v4) is generated and delivered to the user via the URL. The server stores only a **one-way hash** (SHA-256) of the token. On each request the server hashes the incoming token and compares it against the stored hash. This ensures tokens cannot be recovered from the database if it is compromised.

- **Owner URL:** A persistent "Administrative" URL that grants full editing and management rights.
  - _Format:_ `domain.com/edit/[doc_id]?auth=[owner_token]`

- **Owner Token Rotation:** The Owner can regenerate their `owner_token` from the management view. This invalidates the previous URL and produces a new one. The Owner should store their URL securely; there is no email-based recovery in v1 (no user accounts exist).

- **Reviewer URL:** Unique links generated for specific people. These links identify the reviewer by their associated `Share` record in the comment history.
  - _Format:_ `domain.com/review/[doc_id]?invite=[reviewer_token]`

- **Reviewer Permissions:**
  - `view_only` — The reviewer can see the rendered document and leave comments, but **cannot** modify the document text.
  - `suggest_changes` — The reviewer can leave comments **and** make text edits. All edits are automatically wrapped in CriticMarkup tags.

- **Link Expiration & Revocation:**
  - Each share link has an optional `expires_at` timestamp. Once expired, the link returns a `410 Gone` response.
  - The Owner can revoke any share link at any time by setting its `is_active` flag to `false`.

### D. Concurrency Model

This application uses an **asynchronous review workflow**. Simultaneous real-time editing by multiple users is **not supported** in v1.

- **Pessimistic Locking:** When a user (Owner or reviewer) begins editing, the server acquires a document-level lock. If another user attempts to edit concurrently, they receive a `409 Conflict` response indicating the document is currently being edited, along with the name of the active editor.
- **Lock Timeout:** Locks automatically expire after **5 minutes** of inactivity to prevent orphaned locks.

---

## 3. Technical Stack

- **Framework:** Next.js with TypeScript (frontend + API routes in a single codebase).
- **Markdown Engine:** `remark` (unified ecosystem) with a custom plugin for CriticMarkup.
- **Code Editor:** `CodeMirror 6` (lightweight, modular, web-native).
- **ORM:** Prisma (type-safe database access, migrations, and schema management).
- **Database:** PostgreSQL (relational data for documents, shares, and comments).
- **Sanitization:** `DOMPurify` (XSS protection for rendered Markdown).
- **Deployment:** Docker Compose.
  - A single `docker compose up` command must build and start all services (Next.js app + PostgreSQL + reverse proxy).
  - The Compose configuration should handle database initialization and Prisma migrations automatically on first run.
  - Environment variables (e.g., `DATABASE_URL`, `NEXTAUTH_SECRET`) should be configurable via a `.env` file.
  - **HTTPS:** A reverse proxy (Nginx) must terminate TLS using **Let's Encrypt** for automatic certificate provisioning and renewal. HTTP traffic should redirect to HTTPS.

---

## 4. Data Model

### Table: Documents

| Column             | Type      | Constraints               | Description                                              |
| ------------------ | --------- | ------------------------- | -------------------------------------------------------- |
| `id`               | UUID      | Primary Key               | Unique document identifier                               |
| `title`            | String    | NOT NULL                  | Document title                                           |
| `content_raw`      | Text      | NOT NULL, DEFAULT `''`    | The Markdown source (including CriticMarkup)             |
| `owner_token_hash` | String    | NOT NULL                  | SHA-256 hash of the owner's access token                 |
| `status`           | Enum      | NOT NULL, DEFAULT `draft` | One of: `draft`, `in_review`, `finalized`                |
| `locked_by`        | String    | NULLABLE                  | Name/ID of the user currently editing (NULL if unlocked) |
| `lock_expires_at`  | Timestamp | NULLABLE                  | When the current edit lock expires                       |
| `created_at`       | Timestamp | NOT NULL, DEFAULT `NOW()` | When the document was created                            |
| `updated_at`       | Timestamp | NOT NULL, DEFAULT `NOW()` | When the document was last modified (auto-updated)       |

### Table: Shares (Reviewer Links)

| Column              | Type      | Constraints                          | Description                                          |
| ------------------- | --------- | ------------------------------------ | ---------------------------------------------------- |
| `id`                | UUID      | Primary Key                          | Unique share identifier                              |
| `doc_id`            | UUID      | Foreign Key → Documents.id, NOT NULL | The document this share belongs to                   |
| `reviewer_name`     | String    | NOT NULL                             | Display name of the reviewer (e.g., "Alice")         |
| `invite_token_hash` | String    | NOT NULL                             | SHA-256 hash of the reviewer's access token          |
| `permissions`       | Enum      | NOT NULL, DEFAULT `suggest_changes`  | One of: `view_only`, `suggest_changes`               |
| `is_active`         | Boolean   | NOT NULL, DEFAULT `true`             | Whether this share link is active (Owner can revoke) |
| `expires_at`        | Timestamp | NULLABLE                             | Optional expiration date for the link                |
| `created_at`        | Timestamp | NOT NULL, DEFAULT `NOW()`            | When the share link was generated                    |

### Table: Comments

| Column         | Type      | Constraints                          | Description                                                                                  |
| -------------- | --------- | ------------------------------------ | -------------------------------------------------------------------------------------------- |
| `id`           | UUID      | Primary Key                          | Unique comment identifier                                                                    |
| `doc_id`       | UUID      | Foreign Key → Documents.id, NOT NULL | The document this comment belongs to                                                         |
| `share_id`     | UUID      | Foreign Key → Shares.id, NULLABLE    | The share record of the reviewer who authored this comment. NULL if the author is the Owner. |
| `author_name`  | String    | NOT NULL                             | Denormalized display name (copied from `Shares.reviewer_name` or `"Owner"`)                  |
| `text_anchor`  | JSON      | NOT NULL                             | Stores line numbers/character offsets for comment positioning                                |
| `comment_body` | Text      | NOT NULL                             | The comment text                                                                             |
| `status`       | Enum      | NOT NULL, DEFAULT `open`             | One of: `open`, `resolved`                                                                   |
| `resolved_at`  | Timestamp | NULLABLE                             | When the comment was resolved                                                                |
| `created_at`   | Timestamp | NOT NULL, DEFAULT `NOW()`            | When the comment was created                                                                 |

### Table: Document_Versions (History)

| Column             | Type      | Constraints                          | Description                                                  |
| ------------------ | --------- | ------------------------------------ | ------------------------------------------------------------ |
| `id`               | UUID      | Primary Key                          | Unique version identifier                                    |
| `doc_id`           | UUID      | Foreign Key → Documents.id, NOT NULL | The document this version belongs to                         |
| `content_snapshot` | Text      | NOT NULL                             | Full copy of `content_raw` at the time of the snapshot       |
| `change_summary`   | String    | NULLABLE                             | Human-readable label (e.g., "Accepted 3 changes from Alice") |
| `created_by`       | String    | NOT NULL                             | Name of the user who triggered this snapshot                 |
| `created_at`       | Timestamp | NOT NULL, DEFAULT `NOW()`            | When the snapshot was taken                                  |

> **Versioning Policy:** A new version snapshot is created automatically each time the Owner **accepts or rejects** CriticMarkup changes, or when the Owner **manually saves** after a direct edit session. Snapshots are retained indefinitely in v1.

---

## 5. API Specification

All endpoints are served over HTTPS. Authentication is performed via query-string tokens (see §2C). The server hashes the incoming token and matches it against stored hashes.

### Documents

| Method   | Endpoint             | Auth                    | Description                                                      |
| -------- | -------------------- | ----------------------- | ---------------------------------------------------------------- |
| `POST`   | `/api/documents`     | None                    | Create a new document. Returns the Owner URL with the raw token. |
| `GET`    | `/api/documents/:id` | Owner or Reviewer token | Retrieve document metadata and content.                          |
| `PATCH`  | `/api/documents/:id` | Owner token             | Update document content, title, or status.                       |
| `DELETE` | `/api/documents/:id` | Owner token             | Permanently delete the document and all related data.            |

### Shares

| Method  | Endpoint                              | Auth        | Description                                                                       |
| ------- | ------------------------------------- | ----------- | --------------------------------------------------------------------------------- |
| `POST`  | `/api/documents/:id/shares`           | Owner token | Generate a new reviewer link. Body: `{ reviewer_name, permissions, expires_at? }` |
| `GET`   | `/api/documents/:id/shares`           | Owner token | List all share links for the document.                                            |
| `PATCH` | `/api/documents/:id/shares/:share_id` | Owner token | Update share (e.g., revoke by setting `is_active: false`).                        |

### Comments

| Method  | Endpoint                                  | Auth                    | Description                                                 |
| ------- | ----------------------------------------- | ----------------------- | ----------------------------------------------------------- |
| `GET`   | `/api/documents/:id/comments`             | Owner or Reviewer token | List all comments (supports `?status=open` filter).         |
| `POST`  | `/api/documents/:id/comments`             | Owner or Reviewer token | Create a new comment. Body: `{ text_anchor, comment_body }` |
| `PATCH` | `/api/documents/:id/comments/:comment_id` | Owner or Comment author | Resolve a comment (set `status: resolved`).                 |

### Change Review

| Method | Endpoint                            | Auth        | Description                                                                  |
| ------ | ----------------------------------- | ----------- | ---------------------------------------------------------------------------- |
| `GET`  | `/api/documents/:id/changes`        | Owner token | List all pending CriticMarkup change regions.                                |
| `POST` | `/api/documents/:id/changes/accept` | Owner token | Accept specified changes (body: `{ change_ids: [...] }` or `{ all: true }`). |
| `POST` | `/api/documents/:id/changes/reject` | Owner token | Reject specified changes (body: `{ change_ids: [...] }` or `{ all: true }`). |

### Token Management

| Method | Endpoint                          | Auth        | Description                                                                               |
| ------ | --------------------------------- | ----------- | ----------------------------------------------------------------------------------------- |
| `POST` | `/api/documents/:id/rotate-token` | Owner token | Regenerate the owner token. Returns the new Owner URL. The previous token is invalidated. |

---

## 6. User Workflow

1. **Creation:** Owner enters the site, pastes Markdown, and clicks "Create." The document is created in `draft` status.
2. **Management:** Owner is redirected to their **Owner URL**. They can edit the source directly. Each save creates a version snapshot.
3. **Sharing:** Owner changes the document status to `in_review` and enters "Alice" into a share field. The system generates a unique **Reviewer URL** for Alice.
4. **Reviewing:** Alice opens her link.
   - If she has `suggest_changes` permission: any text she types is wrapped in `{++ ++}` tags, any text she deletes is wrapped in `{-- --}` tags, and any replacement is wrapped in `{~~ ~> ~~}` tags.
   - If she has `view_only` permission: she sees a read-only rendered view and can leave sidebar comments.
5. **Finalization:** The Owner views the document. They see Alice's additions in green, deletions in red, and substitutions highlighted. The Owner can "Accept" (remove tags and keep the new text) or "Reject" (remove tags and revert to original text). Each accept/reject action creates a version snapshot.
6. **Closing:** The Owner sets the document status to `finalized`. All reviewer links become read-only. No further suggestions are accepted.

---

## 7. Error Handling

The API uses standard HTTP status codes. All error responses follow the format:

```json
{
  "error": {
    "code": "DOCUMENT_NOT_FOUND",
    "message": "The requested document does not exist or has been deleted."
  }
}
```

| Scenario                                                 | HTTP Status             | Error Code                |
| -------------------------------------------------------- | ----------------------- | ------------------------- |
| Invalid or missing token                                 | `401 Unauthorized`      | `INVALID_TOKEN`           |
| Token valid but insufficient permission                  | `403 Forbidden`         | `INSUFFICIENT_PERMISSION` |
| Document not found or deleted                            | `404 Not Found`         | `DOCUMENT_NOT_FOUND`      |
| Share link expired                                       | `410 Gone`              | `SHARE_EXPIRED`           |
| Share link revoked                                       | `403 Forbidden`         | `SHARE_REVOKED`           |
| Document locked by another user                          | `409 Conflict`          | `DOCUMENT_LOCKED`         |
| Upload exceeds size limit                                | `413 Payload Too Large` | `FILE_TOO_LARGE`          |
| Document is finalized (no edits allowed)                 | `403 Forbidden`         | `DOCUMENT_FINALIZED`      |
| Unresolved changes must be handled before direct editing | `409 Conflict`          | `PENDING_CHANGES`         |

---

## 8. Security Considerations

- **Transport Security:** All traffic **must** be served over **HTTPS/TLS**. Tokens are transmitted as URL query parameters and are therefore visible in browser history and server access logs. The application should set `Referrer-Policy: no-referrer` headers to prevent token leakage via the `Referer` header.
- **Token Generation & Storage:** Tokens are generated as UUID v4 values. The **raw token** is shown to the user once (in the URL). The server stores only the **SHA-256 hash** of each token. This means tokens cannot be recovered from the database.
- **Token Rotation:** The Owner can regenerate their token at any time (see §5 — Token Management). The previous token is immediately invalidated.
- **Sanitization:** All Markdown rendered to HTML must be sanitized (e.g., using `DOMPurify`) to prevent Cross-Site Scripting (XSS) attacks. User-supplied HTML tags within the Markdown must be stripped or escaped.
- **Rate Limiting:** API endpoints must enforce rate limiting (suggested: 60 requests per minute per IP for authenticated endpoints, 10 per minute for unauthenticated endpoints like document creation) to prevent brute-force token guessing and abuse.

---

## 9. Non-Functional Requirements

- **Browser Compatibility:** The application must support the latest two major versions of Chrome, Firefox, Safari, and Edge.
- **Performance:** Page load time should be under **2 seconds** on a standard broadband connection. Document rendering (Markdown → HTML) should complete in under **200ms** for documents up to 5 MB.
- **Availability:** Target **99.5% uptime** (allows ~3.6 hours of downtime per month).
- **Accessibility:** The UI should conform to **WCAG 2.1 Level AA** standards, including keyboard navigation, screen reader support, and sufficient colour contrast for CriticMarkup highlights.
- **Internationalisation:** Out of scope for v1. The UI will be English-only. The system must correctly handle **UTF-8** document content in any language.

---

## 10. Out of Scope (v1)

The following features are explicitly excluded from the initial release to manage scope:

- User accounts, login, or password-based authentication.
- Real-time collaborative editing (e.g., Google Docs-style simultaneous cursors).
- Email notifications for new comments or share invitations.
- Multi-document listing or dashboard (each document is accessed only by its URL).
- CriticMarkup highlights (`{== ==}`) and inline comments (`{>> <<}`).
- Export to PDF or other formats.
- Mobile-optimized UI (responsive design is best-effort, not a hard requirement).
