# Deployment & Configuration — EcoRoute AI

## Local Development

### Prerequisites
- Node.js 20+, PostgreSQL 16+, npm 9+

### Setup
```bash
cp .env.example .env    # Configure environment
npm install             # Install dependencies
npm run db:generate     # Generate Prisma client
npm run db:migrate      # Run migrations
npm run db:seed         # Seed providers & models
npm run dev             # Start frontend + backend
```

## Docker Deployment

```bash
docker compose up --build
```

Services: PostgreSQL (:5432), API (:3001), Web (:3000)

## Production

### Build
```bash
npm run build
npm run db:migrate:deploy
```

### Environment
Set all variables from `.env.example` with production values:
- Strong, unique JWT secrets (64+ characters)
- Production DATABASE_URL
- Appropriate CORS_ORIGIN
- Provider API keys as needed

### Hosting Options

| Component | Options |
|-----------|---------|
| Frontend | Vercel, Netlify, Cloudflare Pages, nginx |
| Backend | Railway, Render, Fly.io, AWS ECS |
| Database | Neon, Supabase, AWS RDS, managed PostgreSQL |

### Health Check
`GET /health` returns `{ status: "healthy", mockMode: boolean, version: "1.0.0" }`

### Backup & Rollback
- Use `pg_dump` for database backups
- Prisma migrations can be rolled back manually
- Version all environment config changes

### Monitoring
- Structured JSON logs via Pino
- Request IDs on all API responses
- Health check endpoint for uptime monitoring
