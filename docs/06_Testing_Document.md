# Testing Document — EcoRoute AI

## Test Strategy

| Layer | Framework | Scope |
|-------|-----------|-------|
| Backend Unit | Vitest | Routing scoring, cost estimation, environmental methodology, password hashing |
| API Integration | Vitest + Fastify inject | All endpoints, validation, auth, RBAC |
| Frontend | Vitest + React Testing Library | Component rendering, forms, states |
| E2E | API-level Vitest | Full user workflow |

## Running Tests

```bash
npm run test          # All tests
npm run test --workspace=apps/api   # Backend only
npm run test --workspace=apps/web   # Frontend only
```

## Key Test Cases

### Authentication
- Register with valid/invalid data
- Login with correct/incorrect credentials
- Token refresh with valid/expired tokens
- Logout revokes sessions
- Admin routes blocked for non-admin users

### Routing Engine
- Task classification detects correct types
- Scoring formula produces expected rankings
- Unavailable models excluded from candidates
- Environmental estimates use documented methodology
- Explanation text includes all required information

### Metrics
- Token estimation: chars/4 approximation
- Cost calculation with pricing metadata
- Environmental estimate with PUE and carbon intensity
- Measurement status correctly assigned

### Frontend
- Landing page renders all sections
- Login form validates input
- Dashboard shows loading/error/result states
- History pagination works
- Settings sliders constrain to valid weights
- Metric badges show correct status labels
