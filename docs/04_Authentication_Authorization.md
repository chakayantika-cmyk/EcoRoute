# Authentication & Authorization — EcoRoute AI

## Authentication Architecture

1. **Password hashing**: Argon2id with 64MB memory, 3 iterations, 4 parallelism
2. **Access tokens**: JWT signed with HS256, 15-minute expiry, contains userId/email/role
3. **Refresh tokens**: 128-byte random hex, SHA-256 hashed before storage, 7-day expiry
4. **Token rotation**: Each refresh invalidates the old token and issues new pair

## Session Flow

```
Register/Login → Access Token (15m) + Refresh Token (7d)
    ↓
API Request → Bearer access token in Authorization header
    ↓
Token Expired → POST /auth/refresh with refresh token → New token pair
    ↓
Logout → Revoke refresh token in database
```

## Security Measures

- Passwords never logged or stored in plaintext
- Refresh tokens stored as SHA-256 hashes
- Login rate limited: 5 attempts per 15 minutes per IP
- API rate limited: 100 requests per minute
- CORS restricted to configured origin
- Helmet security headers (HSTS, X-Frame-Options, etc.)
- Request IDs on all responses for tracing

## Roles & Permissions

| Permission | User | Admin |
|-----------|------|-------|
| Own tasks CRUD | ✓ | ✓ |
| Own preferences | ✓ | ✓ |
| View models | ✓ | ✓ |
| Admin overview | ✗ | ✓ |
| Manage models | ✗ | ✓ |
| View all users | ✗ | ✓ |
| View audit log | ✗ | ✓ |

Admin routes are protected by `adminMiddleware` which verifies the `ADMIN` role from the JWT payload. Frontend route guards are supplementary only.

## Password Reset

1. User requests reset via email
2. Server generates random token, stores SHA-256 hash with 1-hour expiry
3. In development: token logged to console
4. In production: token sent via email (integration required)
5. User submits token + new password
6. All existing sessions revoked, user must re-login
