# EcoRoute AI

**Smarter AI decisions. Lower cost. Better impact.**

EcoRoute AI is an intelligent AI model router that evaluates available AI models — GPT, Gemini, Claude — and selects the most suitable one based on token efficiency, cost, quality, and estimated environmental impact.

## Features

- **Intelligent Routing Engine** — Weighted multi-criteria scoring across token efficiency, cost, quality, and environmental impact
- **Multiple AI Providers** — OpenAI, Google Gemini, Anthropic with extensible adapter architecture
- **Transparent Metrics** — Clear labels distinguishing actual, estimated, simulated, and unavailable measurements
- **Environmental Awareness** — Documented estimation methodology with disclaimers (not direct measurements)
- **Mock Mode** — Fully functional without API keys for development and demonstration
- **Role-Based Access** — User and Admin roles with backend-enforced authorization
- **Secure Authentication** — Argon2id password hashing, JWT access tokens, refresh token rotation
- **Modern UI** — Editorial-inspired design with dark mode, responsive layout, interactive charts
- **Full-Stack** — React frontend, Fastify backend, PostgreSQL database, Docker deployment

## Architecture

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────┐
│   React Frontend │────▶│  Fastify Backend  │────▶│  PostgreSQL  │
│   (Vite + TW)    │◀────│  (REST API)       │◀────│  (Prisma)    │
└──────────────────┘     └────────┬─────────┘     └──────────────┘
                                  │
                     ┌────────────┼────────────┐
                     ▼            ▼            ▼
               ┌──────────┐ ┌──────────┐ ┌──────────┐
               │  OpenAI  │ │  Gemini  │ │ Anthropic│
               │ Adapter  │ │ Adapter  │ │ Adapter  │
               └──────────┘ └──────────┘ └──────────┘
```

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 16+ (or Docker)

### 1. Clone and Install

```bash
git clone <repository-url>
cd ecoroute-ai
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your database URL and secrets
```

### 3. Set Up Database

```bash
# Start PostgreSQL (via Docker if needed)
docker run -d --name ecoroute-pg -e POSTGRES_DB=ecoroute_ai -e POSTGRES_USER=ecoroute -e POSTGRES_PASSWORD=ecoroute_dev -p 5432:5432 postgres:16-alpine

# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed with providers and models
npm run db:seed
```

### 4. Start Development

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- Health check: http://localhost:3001/health

### 5. Docker (Alternative)

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:3001

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | Yes | — | Secret for access tokens (min 16 chars) |
| `JWT_REFRESH_SECRET` | Yes | — | Secret for refresh tokens (min 16 chars) |
| `API_PORT` | No | 3001 | API server port |
| `CORS_ORIGIN` | No | http://localhost:5173 | Frontend origin |
| `OPENAI_API_KEY` | No | — | OpenAI API key (mock mode if absent) |
| `GOOGLE_GEMINI_API_KEY` | No | — | Google Gemini API key |
| `ANTHROPIC_API_KEY` | No | — | Anthropic API key |

See [.env.example](.env.example) for all variables.

## Mock Mode

When no provider API keys are configured, EcoRoute runs in **mock mode**:

- The routing engine still evaluates and scores all models
- Responses are simulated and clearly labeled as `[Simulated]`
- All metrics show `Simulated` or `Estimated` measurement status
- The UI displays a "Mock Mode" banner

This is the default for development and demonstration.

## Provider Configuration

To enable live provider responses, add API keys to your `.env`:

```bash
OPENAI_API_KEY=sk-your-openai-key
GOOGLE_GEMINI_API_KEY=your-gemini-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
```

API keys are stored only on the backend and never exposed to the frontend.

## Routing Strategies

| Strategy | Token | Cost | Quality | Environmental |
|----------|-------|------|---------|---------------|
| Balanced | 25% | 25% | 25% | 25% |
| Lowest Cost | 15% | 55% | 15% | 15% |
| Highest Quality | 10% | 10% | 70% | 10% |
| Eco First | 10% | 10% | 20% | 60% |
| Token Efficient | 55% | 15% | 15% | 15% |

Users can customize weights in Settings.

## Testing

```bash
npm run test        # Run all tests
npm run lint        # ESLint
npm run typecheck   # TypeScript type checking
```

## Production Deployment

```bash
npm run build       # Build all packages
npm run db:migrate:deploy  # Run migrations (production)
```

See [docs/05_Deployment_Configuration.md](docs/05_Deployment_Configuration.md) for details.

## Known Limitations

1. **Environmental impact values are modeled estimates** — not direct measurements
2. **Provider adapters require API keys** for live mode; mock mode is the default
3. **Password reset** logs to console in development (no email service)
4. **Quality scores** are heuristic-based, not from evaluation benchmarks
5. **Token estimation** uses character/4 approximation, not actual tokenizers
6. **No WebSocket** — uses polling for task status

## Documentation

- [Software Requirements Specification](docs/01_SRS.md)
- [Database Design](docs/02_Database_Design.md)
- [API Documentation](docs/03_API_Documentation.md)
- [Authentication & Authorization](docs/04_Authentication_Authorization.md)
- [Deployment & Configuration](docs/05_Deployment_Configuration.md)
- [Testing Document](docs/06_Testing_Document.md)
- Architecture Decision Records: [docs/adr/](docs/adr/)

## License

MIT
