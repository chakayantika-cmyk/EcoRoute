# Software Requirements Specification — EcoRoute AI

## 1. Purpose

EcoRoute AI is an intelligent AI model router that evaluates available AI models and selects the most suitable one for a given task based on token efficiency, cost, quality, and estimated environmental impact.

## 2. Scope

The system provides a web-based SaaS dashboard where users can:
- Submit AI tasks with customizable routing strategies
- View transparent model selection results with metric breakdowns
- Browse task history with search, filtering, and pagination
- Customize routing preferences (weight priorities)
- Access admin functionality for system management

## 3. User Roles

| Role | Capabilities |
|------|-------------|
| **User** | Register, login, submit tasks, view results, manage preferences, view own history |
| **Administrator** | All user capabilities + view all users, manage models/providers, view audit log |

## 4. Functional Requirements

### FR-1: Authentication
- FR-1.1: Users can register with email, password, and display name
- FR-1.2: Users can log in with email and password
- FR-1.3: Sessions use short-lived access tokens (15m) and refresh tokens (7d)
- FR-1.4: Users can reset forgotten passwords
- FR-1.5: All auth events are audit-logged

### FR-2: Task Management
- FR-2.1: Users can submit tasks with text input (up to 10,000 characters)
- FR-2.2: Tasks are automatically routed upon creation
- FR-2.3: Users can retry failed tasks
- FR-2.4: Users can view and delete their own tasks
- FR-2.5: Task history supports search, status filtering, and pagination

### FR-3: Routing Engine
- FR-3.1: Classify tasks by type (code, creative, analysis, math, etc.)
- FR-3.2: Score candidate models using weighted multi-criteria formula
- FR-3.3: Support 5 routing strategies with configurable weights
- FR-3.4: Generate routing explanations with score breakdowns
- FR-3.5: Record all routing decisions with metric snapshots

### FR-4: Metrics
- FR-4.1: Estimate token usage based on input characteristics
- FR-4.2: Estimate cost using configurable pricing metadata
- FR-4.3: Estimate environmental impact using documented methodology
- FR-4.4: Clearly label measurement status (actual/estimated/simulated/unavailable)

### FR-5: Admin
- FR-5.1: View system overview (user count, task count, success rate)
- FR-5.2: Manage AI models and providers
- FR-5.3: View audit event log

## 5. Non-Functional Requirements

- **NFR-1**: API response time < 500ms for non-routing requests
- **NFR-2**: Support 100+ concurrent users
- **NFR-3**: WCAG 2.1 AA accessibility compliance
- **NFR-4**: Responsive design (mobile, tablet, desktop)
- **NFR-5**: All sensitive data encrypted at rest and in transit
- **NFR-6**: Rate limiting on authentication endpoints

## 6. Acceptance Criteria

1. Frontend and backend build successfully
2. Authentication flow works end-to-end
3. Task submission triggers model selection
4. Routing results display with metric breakdowns
5. Mock mode works without API keys
6. Admin routes are protected server-side
7. Environmental estimates are clearly labeled as estimates
