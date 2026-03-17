# nano-SYNAPSYS Backend

> **This is a standalone component.** It should be hosted in its own repository
> (`nano-SYNAPSYS-backend`) with its own deployment pipeline, separate from the iOS client.

## Splitting Into Its Own Repo

```bash
cd backend
./split-repo.sh
```

This creates a new git repo at `../nano-SYNAPSYS-backend/` with all backend files.
Then remove `backend/` from this iOS repo:

```bash
git rm -r backend/
git commit -m "refactor: remove backend (moved to nano-SYNAPSYS-backend repo)"
```

## Quick Start

```bash
npm install
node migrate.js
node server.js
```

See [BACKEND.md](BACKEND.md) for full documentation, API reference, and deployment guides.

## Infrastructure

| Component | nano-SYNAPSYS Backend | ai-evolution.com.au |
|-----------|----------------------|---------------------|
| Domain | `api.nanosynapsys.com` | `www.ai-evolution.com.au` |
| Database | Own SQLite instance | Separate |
| Auth/JWT | Own secret/tokens | Separate |
| WebSocket | Own WSS endpoint | None |
| Deployment | Own Railway/Fly/VPS | Separate |

**Zero shared infrastructure.** Different domains, databases, auth systems, and deployment pipelines.
