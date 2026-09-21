# API Documentation — EcoRoute AI

Base URL: `http://localhost:3001/api/v1`

All responses follow the format:
```json
{ "data": {}, "meta": { "requestId": "uuid" } }
```

Errors:
```json
{ "error": { "code": "ERROR_CODE", "message": "...", "requestId": "uuid" } }
```

## Authentication

### POST /auth/register
Create a new account.
```json
{ "email": "user@example.com", "password": "SecureP@ss1", "displayName": "User" }
```
Response: `201` with `{ user, accessToken, refreshToken, expiresIn }`

### POST /auth/login
```json
{ "email": "user@example.com", "password": "SecureP@ss1" }
```
Response: `200` with `{ user, accessToken, refreshToken, expiresIn }`

### POST /auth/logout
Headers: `Authorization: Bearer <accessToken>`
```json
{ "refreshToken": "..." }
```

### POST /auth/refresh
```json
{ "refreshToken": "..." }
```
Response: `200` with `{ accessToken, refreshToken, expiresIn }`

### GET /auth/me
Headers: `Authorization: Bearer <accessToken>`
Response: `200` with user profile

### POST /auth/forgot-password
```json
{ "email": "user@example.com" }
```

### POST /auth/reset-password
```json
{ "token": "reset-token", "password": "NewP@ss123" }
```

## Tasks

All require `Authorization: Bearer <accessToken>`

### POST /tasks
Create and auto-route a task.
```json
{ "inputText": "Write a binary search tree...", "routingStrategy": "balanced" }
```
Response: `201` with full task including routingResult and answer

### GET /tasks
Query params: `page`, `pageSize`, `search`, `status`
Response: Paginated task list

### GET /tasks/:taskId
Full task with routing result, answer, and metrics

### DELETE /tasks/:taskId

### POST /tasks/:taskId/retry
Re-route a task

## Preferences

### GET /preferences
### PUT /preferences
```json
{ "tokenEfficiencyWeight": 0.3, "costWeight": 0.2, "qualityWeight": 0.3, "environmentalWeight": 0.2, "defaultStrategy": "balanced" }
```
### POST /preferences/reset

## Models

### GET /models
### GET /models/:modelId
### GET /models/providers
### GET /models/providers/health

## Admin (requires ADMIN role)

### GET /admin/overview
### GET /admin/users
### GET /admin/audit-events
### POST /admin/models
### PUT /admin/models/:modelId
### PUT /admin/providers/:providerId

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Validation error |
| 401 | Authentication required |
| 403 | Insufficient permissions |
| 404 | Not found |
| 409 | Conflict |
| 429 | Rate limit exceeded |
| 500 | Internal error |
