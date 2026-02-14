# MarkdownReview Hub

A web-based collaboration tool designed for reviewing and editing Markdown documents with support for CriticMarkup syntax and token-based access control.

## Project Status

**Phase 6.2 (Accessibility - WCAG 2.1 AA)** - Completed

- ✅ Keyboard Navigation:
  - All interactive elements are keyboard navigable with visible focus indicators
  - Focus-visible styles for keyboard users (`:focus-visible` CSS)
  - Skip link for keyboard users to bypass navigation
  - Escape key closes modals and side panels
  - Focus trapping in modals
  - Tab navigation works correctly in all panels

- ✅ ARIA Labels & Roles:
  - All buttons have descriptive `aria-label` attributes
  - Form inputs have proper `id`/`for` associations and `aria-describedby`
  - Side panels use `role="dialog"` with `aria-modal="true"` and `aria-labelledby`
  - Tab lists use proper `role="tablist"`/`role="tab"` semantics
  - Lists use `role="list"` with keyboard-interactive items
  - Status badges use `role="status"` for live updates
  - Loading states have proper `role="status"` and `aria-label`
  - Decorative emojis are hidden from screen readers with `aria-hidden="true"`

- ✅ Toast Notifications:
  - Toasts use `role="alert"` for screen reader announcements
  - Error toasts use `aria-live="assertive"` for immediate announcement
  - Other toasts use `aria-live="polite"` to avoid interruption
  - `aria-atomic="true"` ensures full message is read

- ✅ Color Contrast (WCAG AA Compliant):
  - CriticMarkup additions: #14532d on #dcfce7 (7:1 contrast ratio)
  - CriticMarkup deletions: #7f1d1d on #fee2e2 (6.5:1 contrast ratio)
  - Substitution deletions: #78350f on #fef3c7 (6:1 contrast ratio)
  - Substitution insertions: #1e3a8a on #dbeafe (6.5:1 contrast ratio)
  - All ratios exceed WCAG AA requirement of 4.5:1

**Previous Phases:**

- Phase 6.1 complete - Error Handling & UX with Error Boundary, Toast Notifications, Network Error Handling, and Loading States.
- Phase 5 complete - Frontend Sharing & Comments with Share Management Panel, Comments Sidebar, and Change Review Panel.
- Phase 4 complete - Frontend Editor & Viewer with CodeMirror 6, CriticMarkup highlighting, live preview.
- Phase 3 complete - CriticMarkup engine with parser, resolver, remark plugin, and 80 unit tests.
- Phase 2 complete - Shares & Comments API with token rotation.
- Phase 1.4 complete - File upload with size validation and UTF-8 encoding.
- Phase 1.3 complete - Document locking with auto-expiry after 5 minutes.
- Phase 1.2 complete - Document CRUD endpoints with token authentication.
- Phase 1.1 complete - Authentication middleware with token hashing, verification, and error handling.
- Phase 0.3 complete - Database schema defined and initial Prisma migration created.

## Tech Stack

- **Framework:** Next.js 15 with TypeScript
- **Styling:** Tailwind CSS + CSS Variables design system
- **Code Editor:** CodeMirror 6 with custom CriticMarkup extensions
- **Markdown Engine:** remark (unified ecosystem) with CriticMarkup preprocessor
- **Sanitization:** DOMPurify (isomorphic) for XSS protection
- **Fonts:** Inter (UI) + JetBrains Mono (code/editor)
- **Code Quality:** ESLint + Prettier
- **Git Hooks:** Husky + lint-staged
- **Database:** PostgreSQL 16
- **ORM:** Prisma
- **Deployment:** Docker Compose

## Getting Started

### Prerequisites

**For Local Development:**

- Node.js 20.x or later
- npm
- Docker and Docker Compose (for containerized setup)

**For Production:**

- Docker and Docker Compose

### Local Development Setup

#### Option 1: Docker Compose (Recommended)

```bash
# Copy environment variables template
cp .env.example .env

# Edit .env and set required variables (at minimum, set POSTGRES_PASSWORD)
# For local development, you can use simple values

# Start all services (database + app)
docker compose up

# The app will be available at http://localhost:3000
# PostgreSQL will be available at localhost:5432
```

The `docker-compose.override.yml` automatically configures the environment for local development with:

- Hot reload enabled
- Database port exposed for direct access

#### Option 2: Native Node.js

```bash
# Install dependencies
npm install

# Set up local PostgreSQL and configure DATABASE_URL in .env

# Run Prisma migrations (once database schema is created)
npx prisma migrate dev

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Production Deployment

#### 1. Server Setup

```bash
# Clone the repository to your production server
git clone <repository-url>
cd markdown_review_hub

# Copy and configure environment variables
cp .env.example .env
```

#### 2. Configure Environment Variables

Edit `.env` and set the following required variables:

```bash
# Database
POSTGRES_PASSWORD=<strong-random-password>

# NextAuth (generate with: openssl rand -base64 32)
NEXTAUTH_SECRET=<random-secret>
NEXTAUTH_URL=http://your-server-address:3000
```

#### 3. Start Production Services

```bash
# Build and start all services
docker compose up -d

# View logs
docker compose logs -f

# Check service status
docker compose ps
```

The application will be available at `http://your-server-address:3000`.

**Note:** For HTTPS, deploy behind a reverse proxy (e.g., Traefik, Caddy, or cloud load balancer) that handles TLS termination.

### Available Scripts

**Development:**

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server

**Code Quality:**

- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

**Database (when Prisma is configured):**

- `npx prisma migrate dev` - Create and apply migrations in development
- `npx prisma migrate deploy` - Apply migrations in production
- `npx prisma studio` - Open Prisma Studio GUI

**Docker:**

- `docker compose up` - Start in development mode
- `docker compose up -d` - Start in detached mode (production)
- `docker compose down` - Stop all services
- `docker compose logs -f` - View logs

## Architecture

### Services

The application consists of the following Docker services:

- **app** - Next.js application (Node.js 20 Alpine)
- **db** - PostgreSQL 16 database

### Database Schema

The PostgreSQL database contains the following tables (managed by Prisma ORM):

- **documents** - Core document storage with title, Markdown content (including CriticMarkup), owner token hash, status (`draft`/`in_review`/`finalized`), and pessimistic locking fields.
- **shares** - Reviewer access links with hashed invite tokens, permissions (`view_only`/`suggest_changes`), activation status, and optional expiration.
- **comments** - Document comments anchored to specific text ranges (line/character offsets), with `open`/`resolved` status tracking.
- **document_versions** - Version history snapshots created on accept/reject of changes or manual saves.

All tables use UUID primary keys and cascade deletes from the parent document. Prisma migrations run automatically on container startup via `npx prisma migrate deploy`.

### Network Architecture

```
Internet → Next.js App (Port 3000) → PostgreSQL (Port 5432)
```

### Frontend Architecture

The frontend is built with Next.js App Router and consists of:

- **Landing Page (`/`)** — Create new documents via form or `.md` file upload
- **Owner View (`/edit/[docId]`)** — Full editing with document management controls
- **Reviewer View (`/review/[docId]`)** — Read-only or suggest-changes mode

**Key Components:**

| Component          | Path                                         | Description                                                               |
| ------------------ | -------------------------------------------- | ------------------------------------------------------------------------- |
| `CodeMirrorEditor` | `src/components/editor/CodeMirrorEditor.tsx` | CodeMirror 6 editor with CriticMarkup highlighting and reviewer auto-wrap |
| `MarkdownPreview`  | `src/components/editor/MarkdownPreview.tsx`  | Live Markdown preview with remark pipeline and DOMPurify sanitization     |
| `EditorLayout`     | `src/components/editor/EditorLayout.tsx`     | Split-pane layout with Editor/Preview/Split toggle                        |
| `DocumentToolbar`  | `src/components/editor/DocumentToolbar.tsx`  | Title editing, status badge, delete/rotate token controls                 |
| `StatusBadge`      | `src/components/ui/StatusBadge.tsx`          | Color-coded status indicator                                              |
| `ConfirmModal`     | `src/components/ui/ConfirmModal.tsx`         | Confirmation dialog for destructive actions                               |
| `Toast`            | `src/components/ui/Toast.tsx`                | Transient notification messages                                           |
| `ToastContext`     | `src/components/ui/ToastContext.tsx`         | Global toast provider and `useToast` hook                                 |
| `ErrorBoundary`    | `src/components/ui/ErrorBoundary.tsx`        | Global error boundary with fallback UI                                    |
| `LoadingSpinner`   | `src/components/ui/LoadingSpinner.tsx`       | Consistent loading indicators and overlays                                |

**Hooks:**

| Hook          | Path                                 | Description                                                       |
| ------------- | ------------------------------------ | ----------------------------------------------------------------- |
| `useDocument` | `src/hooks/useDocument.ts`           | Document CRUD, locking, network error retry, and state management |
| `useToast`    | `src/components/ui/ToastContext.tsx` | Access global toast notifications anywhere in the app             |

**Utilities:**

| Module              | Path                           | Description                                                    |
| ------------------- | ------------------------------ | -------------------------------------------------------------- |
| `api-client`        | `src/lib/api-client.ts`        | Centralized API client with token handling and automatic retry |
| `markdown-renderer` | `src/lib/markdown-renderer.ts` | remark + DOMPurify rendering pipeline                          |

### Security Features

- **Token Hashing:** SHA-256 hashing for access tokens (see [Authentication Module](src/lib/auth/README.md))
- **Token-Based Access:** UUID v4 tokens with one-way hashing ensure tokens cannot be recovered from database
- **Non-root Containers:** Application runs as unprivileged user

**Note:** For production deployments requiring HTTPS, deploy behind a reverse proxy or load balancer that handles TLS termination.

## Development

This project uses:

- **ESLint** for code linting
- **Prettier** for code formatting
- **Husky** for Git hooks
- **lint-staged** for running linters on staged files

Code is automatically linted and formatted on commit.

### Error Handling & UX

The application includes comprehensive error handling:

**Global Error Boundary:**

- Catches JavaScript errors anywhere in the component tree
- Displays a user-friendly fallback UI with "Try Again" and "Reload Page" options
- Shows error details in development mode for debugging

**Toast Notifications:**

```tsx
import { useToast } from '@/components/ui/ToastContext'

function MyComponent() {
  const { success, error, warning, info } = useToast()

  const handleSave = async () => {
    try {
      await saveDocument()
      success('Document saved!')
    } catch (err) {
      error('Failed to save document')
    }
  }
}
```

**Network Error Retry:**

- API client automatically retries failed requests with exponential backoff
- Network errors display a "Retry" button in the UI
- Configurable retry options: `maxRetries`, `baseDelay`, `exponentialBackoff`

**Loading States:**

```tsx
import LoadingSpinner, { LoadingOverlay, LoadingDots } from '@/components/ui/LoadingSpinner';

// Centered spinner with message
<LoadingSpinner size="lg" message="Loading..." centered />

// Inline loading dots
<button disabled={loading}>
  {loading ? <LoadingDots /> : 'Save'}
</button>

// Blocking overlay
{isProcessing && <LoadingOverlay message="Processing..." />}
```

### Accessibility (WCAG 2.1 AA)

The application is designed to meet WCAG 2.1 Level AA accessibility standards:

**Keyboard Navigation:**

- All interactive elements are focusable and operable with keyboard
- Visible focus indicators using `:focus-visible` CSS
- Skip link allows keyboard users to bypass navigation
- Escape key closes modals and side panels
- Tab navigation works correctly in all dialogs and panels

**ARIA Support:**

- All buttons have descriptive `aria-label` attributes
- Form inputs have proper label associations
- Dialogs use `role="dialog"` with `aria-modal="true"`
- Tab interfaces use proper `role="tablist"`/`role="tab"` semantics
- Dynamic content uses `role="status"` for live updates
- Decorative icons are hidden from screen readers

**Color Contrast:**
All CriticMarkup highlights meet WCAG AA contrast requirements (minimum 4.5:1):

- Additions: #14532d on #dcfce7 (7:1 ratio)
- Deletions: #7f1d1d on #fee2e2 (6.5:1 ratio)
- Substitutions: Uses distinct yellow/blue backgrounds with appropriate text colors

**Focus Management:**

```css
/* Focus-visible styles for keyboard navigation */
*:focus-visible {
  outline: 2px solid var(--focus-ring-color);
  outline-offset: 2px;
}

/* Skip link for keyboard users */
.skip-link:focus {
  top: 0;
}
```

### Authentication in API Routes

The authentication middleware is available for protecting API endpoints. See the [Authentication Module Documentation](src/lib/auth/README.md) for detailed usage examples.

**Basic usage:**

```typescript
import { authenticate, createErrorResponse } from '@/lib/auth'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await authenticate(request, params.id)
    // auth.role is either 'OWNER' or 'REVIEWER'
    // auth.reviewerInfo contains permissions for reviewers

    // Your API logic here...
    return NextResponse.json({ data: '...' })
  } catch (error) {
    return createErrorResponse(error)
  }
}
```

**Owner-only routes:**

```typescript
import { requireOwner, createErrorResponse } from '@/lib/auth'

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireOwner(request, params.id) // Throws if not owner
    // Your deletion logic...
    return NextResponse.json({ deleted: true })
  } catch (error) {
    return createErrorResponse(error)
  }
}
```

### Document API Endpoints

The following REST endpoints are available for document management:

#### Create Document

```http
POST /api/documents
Content-Type: application/json

{
  "title": "My Document",
  "content": "# Hello World\n\nThis is markdown content."
}
```

**Response (201 Created):**

```json
{
  "id": "uuid",
  "title": "My Document",
  "status": "draft",
  "ownerUrl": "http://localhost:3000/edit/{id}?auth={token}",
  "createdAt": "2026-02-07T12:00:00.000Z"
}
```

**Note:** No authentication required. The returned `ownerUrl` contains the owner token and should be stored securely.

#### Upload Document

Upload a `.md` file to create a new document. The file must be UTF-8 encoded and not exceed the configured maximum size (default: 5 MB, configurable via `MAX_UPLOAD_SIZE_MB` environment variable).

```http
POST /api/documents/upload
Content-Type: multipart/form-data

file: <your-markdown-file.md>
```

**Response (201 Created):**

```json
{
  "id": "uuid",
  "title": "Document Title",
  "status": "draft",
  "ownerUrl": "http://localhost:3000/edit/{id}?auth={token}",
  "createdAt": "2026-02-07T12:00:00.000Z"
}
```

**Notes:**

- No authentication required
- Title is automatically extracted from the first H1 heading in the file, or falls back to the filename
- Only `.md` files are accepted
- File must be UTF-8 encoded

**Error Responses:**

- `400 Bad Request` - No file provided, invalid file type, or invalid encoding
- `413 Payload Too Large` - File exceeds the maximum upload size

```json
{
  "error": {
    "code": "FILE_TOO_LARGE",
    "message": "File size exceeds the maximum limit of 5 MB."
  }
}
```

#### Get Document

```http
GET /api/documents/{id}?auth={owner_token}
# or
GET /api/documents/{id}?invite={reviewer_token}
```

**Response (200 OK):**

```json
{
  "id": "uuid",
  "title": "My Document",
  "content": "# Hello World...",
  "status": "draft",
  "lockedBy": null,
  "createdAt": "2026-02-07T12:00:00.000Z",
  "updatedAt": "2026-02-07T12:00:00.000Z",
  "role": "OWNER"
}
```

For reviewers, `permissions` and `reviewerName` are also included.

#### Update Document

```http
PATCH /api/documents/{id}?auth={owner_token}
Content-Type: application/json

{
  "title": "Updated Title",
  "content": "Updated content...",
  "status": "in_review"
}
```

**Response (200 OK):**

```json
{
  "id": "uuid",
  "title": "Updated Title",
  "content": "Updated content...",
  "status": "in_review",
  "updatedAt": "2026-02-07T12:30:00.000Z"
}
```

**Note:** Only the owner can update documents. All fields are optional but at least one must be provided.

#### Delete Document

```http
DELETE /api/documents/{id}?auth={owner_token}
```

**Response (200 OK):**

```json
{
  "message": "Document deleted successfully."
}
```

**Note:** Only the owner can delete documents. This permanently removes the document and all associated shares, comments, and versions.

#### Lock Management

The locking system prevents concurrent editing conflicts. Locks automatically expire after 5 minutes of inactivity.

**Get Lock Status:**

```http
GET /api/documents/{id}/lock?auth={token}
```

**Response (200 OK):**

```json
{
  "isLocked": true,
  "lockedBy": "Owner",
  "lockExpiresAt": "2026-02-07T12:05:00.000Z"
}
```

**Acquire/Refresh/Release Lock:**

```http
POST /api/documents/{id}/lock?auth={token}
Content-Type: application/json

{
  "action": "acquire"  // or "refresh" or "release"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "lockedBy": "Owner",
  "lockExpiresAt": "2026-02-07T12:05:00.000Z"
}
```

**Error Response (409 Conflict):**

```json
{
  "error": {
    "code": "DOCUMENT_LOCKED",
    "message": "Document is currently being edited by Alice."
  }
}
```

**Note:** Attempting to update a document via `PATCH` while another user holds the lock will return a `409 DOCUMENT_LOCKED` error.

### Shares API Endpoints

Shares allow the document owner to generate unique reviewer URLs with specific permissions.

#### Create Share

```http
POST /api/documents/{id}/shares?auth={owner_token}
Content-Type: application/json

{
  "reviewer_name": "Alice",
  "permissions": "suggest_changes",
  "expires_at": "2026-03-01T00:00:00.000Z"
}
```

**Request Body:**

- `reviewer_name` (required): Display name for the reviewer
- `permissions` (optional): `"view_only"` or `"suggest_changes"` (default)
- `expires_at` (optional): ISO 8601 date string for link expiration

**Response (201 Created):**

```json
{
  "id": "uuid",
  "reviewerName": "Alice",
  "permissions": "suggest_changes",
  "isActive": true,
  "expiresAt": "2026-03-01T00:00:00.000Z",
  "reviewerUrl": "http://localhost:3000/review/{id}?invite={token}",
  "createdAt": "2026-02-07T12:00:00.000Z"
}
```

**Note:** Only the owner can create shares. The `reviewerUrl` contains the raw token and should be shared securely with the reviewer.

#### List Shares

```http
GET /api/documents/{id}/shares?auth={owner_token}
```

**Response (200 OK):**

```json
{
  "shares": [
    {
      "id": "uuid",
      "reviewerName": "Alice",
      "permissions": "suggest_changes",
      "isActive": true,
      "isExpired": false,
      "expiresAt": "2026-03-01T00:00:00.000Z",
      "createdAt": "2026-02-07T12:00:00.000Z"
    }
  ]
}
```

**Note:** Only the owner can list shares.

#### Update Share

```http
PATCH /api/documents/{id}/shares/{shareId}?auth={owner_token}
Content-Type: application/json

{
  "is_active": false
}
```

**Request Body (all optional):**

- `is_active`: Boolean to revoke (`false`) or reactivate (`true`) the share
- `permissions`: `"view_only"` or `"suggest_changes"`
- `expires_at`: ISO 8601 date string or `null` to remove expiration

**Response (200 OK):**

```json
{
  "id": "uuid",
  "reviewerName": "Alice",
  "permissions": "suggest_changes",
  "isActive": false,
  "expiresAt": "2026-03-01T00:00:00.000Z",
  "createdAt": "2026-02-07T12:00:00.000Z"
}
```

**Error Responses:**

- `403 SHARE_REVOKED` - When accessing a revoked share link
- `410 SHARE_EXPIRED` - When accessing an expired share link

### Comments API Endpoints

Comments allow owners and reviewers to leave feedback anchored to specific text positions.

#### List Comments

```http
GET /api/documents/{id}/comments?auth={token}
# or with status filter
GET /api/documents/{id}/comments?auth={token}&status=open
```

**Query Parameters:**

- `status` (optional): Filter by `"open"` or `"resolved"`

**Response (200 OK):**

```json
{
  "comments": [
    {
      "id": "uuid",
      "authorName": "Alice",
      "textAnchor": {
        "startLine": 5,
        "endLine": 5,
        "startChar": 0,
        "endChar": 20
      },
      "commentBody": "This paragraph needs more detail.",
      "status": "open",
      "resolvedAt": null,
      "createdAt": "2026-02-07T12:00:00.000Z"
    }
  ]
}
```

#### Create Comment

```http
POST /api/documents/{id}/comments?auth={token}
Content-Type: application/json

{
  "text_anchor": {
    "startLine": 5,
    "endLine": 5,
    "startChar": 0,
    "endChar": 20
  },
  "comment_body": "This paragraph needs more detail."
}
```

**Request Body:**

- `text_anchor` (required): Object with `startLine`, `endLine`, `startChar`, `endChar` (all integers)
- `comment_body` (required): The comment text

**Response (201 Created):**

```json
{
  "id": "uuid",
  "authorName": "Alice",
  "textAnchor": {
    "startLine": 5,
    "endLine": 5,
    "startChar": 0,
    "endChar": 20
  },
  "commentBody": "This paragraph needs more detail.",
  "status": "open",
  "createdAt": "2026-02-07T12:00:00.000Z"
}
```

**Notes:**

- Both owners and reviewers (including `view_only`) can create comments
- Comments cannot be created on finalized documents
- Author name is automatically set based on the authenticated user

#### Resolve Comment

```http
PATCH /api/documents/{id}/comments/{commentId}?auth={token}
Content-Type: application/json

{
  "status": "resolved"
}
```

**Response (200 OK):**

```json
{
  "id": "uuid",
  "authorName": "Alice",
  "textAnchor": {
    "startLine": 5,
    "endLine": 5,
    "startChar": 0,
    "endChar": 20
  },
  "commentBody": "This paragraph needs more detail.",
  "status": "resolved",
  "resolvedAt": "2026-02-07T14:00:00.000Z",
  "createdAt": "2026-02-07T12:00:00.000Z"
}
```

**Notes:**

- Only the owner or the comment author can resolve a comment
- Comments are immutable after creation (cannot be edited, only resolved)

### Token Rotation

Allows the owner to regenerate their access token, invalidating the previous one.

#### Rotate Owner Token

```http
POST /api/documents/{id}/rotate-token?auth={current_owner_token}
```

**Response (200 OK):**

```json
{
  "message": "Owner token has been rotated successfully. The previous token is now invalid.",
  "ownerUrl": "http://localhost:3000/edit/{id}?auth={new_token}"
}
```

**Notes:**

- The previous token is immediately invalidated
- Store the new URL securely; there is no recovery mechanism

### CriticMarkup Change Review API

The CriticMarkup engine allows the owner to review and accept/reject tracked changes made by reviewers.

**Supported CriticMarkup Syntax:**

- Additions: `{++ added text ++}`
- Deletions: `{-- deleted text --}`
- Substitutions: `{~~ original ~> replacement ~~}`

#### List Pending Changes

```http
GET /api/documents/{id}/changes?auth={owner_token}
```

**Response (200 OK):**

```json
{
  "changes": [
    {
      "id": "addition-15-28",
      "type": "addition",
      "original": null,
      "replacement": "new text",
      "position": {
        "startOffset": 15,
        "endOffset": 28,
        "startLine": 2,
        "endLine": 2
      }
    },
    {
      "id": "deletion-50-72",
      "type": "deletion",
      "original": "removed text",
      "replacement": null,
      "position": {
        "startOffset": 50,
        "endOffset": 72,
        "startLine": 4,
        "endLine": 4
      }
    },
    {
      "id": "substitution-100-130",
      "type": "substitution",
      "original": "old phrase",
      "replacement": "new phrase",
      "position": {
        "startOffset": 100,
        "endOffset": 130,
        "startLine": 6,
        "endLine": 6
      }
    }
  ],
  "hasUnresolvedChanges": true
}
```

**Note:** Only the owner can view pending changes.

#### Accept Changes

Accept specified changes, removing the CriticMarkup syntax and keeping the new/replacement text.

```http
POST /api/documents/{id}/changes/accept?auth={owner_token}
Content-Type: application/json

{
  "all": true
}
```

Or accept specific changes:

```http
POST /api/documents/{id}/changes/accept?auth={owner_token}
Content-Type: application/json

{
  "change_ids": ["addition-15-28", "substitution-100-130"]
}
```

**Response (200 OK):**

```json
{
  "content": "Updated document content with changes applied...",
  "changesProcessed": 2,
  "summary": "Accepted 1 addition, 1 substitution.",
  "versionId": "uuid"
}
```

**Notes:**

- A DocumentVersion snapshot is automatically created
- Cannot accept changes on finalized documents

#### Reject Changes

Reject specified changes, removing the CriticMarkup syntax and keeping the original text.

```http
POST /api/documents/{id}/changes/reject?auth={owner_token}
Content-Type: application/json

{
  "all": true
}
```

Or reject specific changes:

```http
POST /api/documents/{id}/changes/reject?auth={owner_token}
Content-Type: application/json

{
  "change_ids": ["deletion-50-72"]
}
```

**Response (200 OK):**

```json
{
  "content": "Updated document content with changes reverted...",
  "changesProcessed": 1,
  "summary": "Rejected 1 deletion.",
  "versionId": "uuid"
}
```

**Notes:**

- For additions: the added text is removed
- For deletions: the deleted text is restored
- For substitutions: the original text is kept, replacement is discarded
- A DocumentVersion snapshot is automatically created

## Troubleshooting

### Local Development

**Port conflicts:**

```bash
# Check what's using port 3000 or 5432
netstat -ano | findstr :3000
netstat -ano | findstr :5432

# Stop conflicting services or change ports in docker-compose.override.yml
```

**Database connection issues:**

```bash
# Check database logs
docker compose logs db

# Verify database is healthy
docker compose ps
```

### Production

**App not starting:**

```bash
# Check app logs
docker compose logs app

# Verify environment variables
docker compose config
```

## License

Private project - All rights reserved
