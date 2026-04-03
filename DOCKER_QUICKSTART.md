# Docker Quickstart Guide

This project includes two different Docker configurations: one tailored for **local development** and one for **production**.

Below is an explanation of the files and how to use them.

---

## 1. Local Development (Hot-Reloading)

**Files Used:**

- `Dockerfile.dev`: Installs all dependencies and runs the Next.js development server (`npm run dev`).
- `docker-compose.yml`: Base configuration containing the database structure and app network.
- `docker-compose.override.yml`: Automatically merges with the base config to apply development settings (bind-mounting your local code, using `Dockerfile.dev`, setting `NODE_ENV: development`, and overriding the startup command).

### How to use it

Because Docker Compose automatically picks up `docker-compose.override.yml`, deploying the local development environment is as simple as running:

```bash
docker compose up -d --build
```

**What happens?**

- The database starts on port `5433` (to avoid conflicting with a local Postgres install).
- The Next.js app starts on port `3000`.
- **Hot-reloading is enabled:** Because your local directory (`.`) is mapped to `/app` inside the container, as soon as you change a file locally, the Next.js dev server will instantly reflect the changes.
- To view logs of your live application, run: `docker compose logs -f app`
- To stop the environment, run: `docker compose down`

---

## 2. Production Environment

**Files Used:**

- `Dockerfile`: A multi-stage build that compiles the Next.js application (`npm run build`) and creates a minimal, optimized production-ready image.
- `docker-compose.yml`: The base configuration without the override logic.

### How to use it

In a production environment (like a VPS or cloud server), you generally do not include the `docker-compose.override.yml` file. When you run Docker Compose without the override file, it defaults to the production setup.

To simulate production locally (ignoring the override file), you must explicitly tell Docker Compose to only use the base file:

```bash
docker compose -f docker-compose.yml up -d --build
```

**What happens?**

- The database starts on its default port `5432` within the docker network.
- The Next.js app is compiled into static/optimized assets and starts using `npm start`.
- No local files are mounted, so changing your local source code **will not** update the live application.
- The application will be extremely fast and optimized for end users.
