# Scripts

Utility scripts for the project.

## Backend Scripts

| Script | Location | Description |
|--------|----------|-------------|
| Migration runner | `backend/scripts/migrate.js` | Applies pending SQL migrations |
| Seed runner | `backend/scripts/seed.js` | Seeds development data |

## Usage

```bash
# Run migrations
cd backend && npm run migrate

# Seed development data
cd backend && npm run seed
```

## Writing New Scripts

- Keep scripts simple and single-purpose.
- Always include a production guard for destructive operations.
- Never hardcode credentials — use environment variables.
