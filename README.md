# MarkdownReview Hub

A web-based collaboration tool designed for reviewing and editing Markdown documents.

## Project Status

Currently in initial setup phase (Phase 0.1).

## Tech Stack

- **Framework:** Next.js 15 with TypeScript
- **Styling:** Tailwind CSS
- **Code Quality:** ESLint + Prettier
- **Git Hooks:** Husky + lint-staged
- **Database:** PostgreSQL (to be configured)
- **ORM:** Prisma (to be configured)

## Getting Started

### Prerequisites

- Node.js 18.x or later
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

## Development

This project uses:

- **ESLint** for code linting
- **Prettier** for code formatting
- **Husky** for Git hooks
- **lint-staged** for running linters on staged files

Code is automatically linted and formatted on commit.

## License

Private project - All rights reserved
