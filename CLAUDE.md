# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FediDeck is a multi-column Mastodon/Fediverse client built with React, TypeScript, Vite, and Zustand. It provides a TweetDeck-style interface for monitoring multiple timelines across multiple accounts and instances.

## Commands

```bash
# Development
npm run dev           # Start Vite dev server with HMR

# Build
npm run build         # TypeScript compile + Vite build

# Testing
npm run test          # Run Vitest in watch mode
npm run test:run      # Run tests once (CI mode)
npm run test:ui       # Run tests with Vitest UI

# Linting
npm run lint          # ESLint check

# Formatting
npm run format        # Format code with Prettier
npm run format:check  # Check code formatting with Prettier

# Git Hooks
npm run prepare       # Setup Husky git hooks (runs automatically on install)
```

### Auto-Formatting

This project uses Prettier with Husky and lint-staged for automatic code formatting:
- Pre-commit hook automatically formats staged TypeScript/TSX/JS/JSX files
- Run `npm run format` manually to format all files
- Run `npm run format:check` to verify formatting without making changes

#### Code Style Standards

Per `.prettierrc`:
- **Indentation**: 4 spaces
- **Quotes**: Single quotes
- **Semicolons**: Required
- **Trailing commas**: ES5 compatible
- **Line width**: 100 characters

## Architecture

### State Management (Zustand)

Three core stores in `src/store/`:

- **`accounts.ts`** - Session management for logged-in accounts. Session ID format: `${accountId}@${instanceUrl.hostname}`. Persists to localStorage.
- **`columns.ts`** - Column configuration (type, account, params). Each column references an account session. Persists to localStorage.
- **`streams.ts`** - Runtime timeline/notification data. Stream key format: `accountId:streamType` or `accountId:streamType:param`. Not persisted.

### Multi-Account Architecture

Each account session contains its own access token and instance URL. Columns are bound to specific accounts via `accountId`. The active account (shown in sidebar) is separate from column ownership - interactions within a column use that column's account.

### Mastodon API Layer (`src/api/`)

- **`mastoClient.ts`** - REST API wrapper using `masto` library. Caches clients by `instanceUrl:accountId`. Handles timeline fetching, status actions (favorite/reblog), media uploads.
- **`streamingClient.ts`** - Custom WebSocket client for real-time updates. Uses event callbacks (not masto.js async iterators) for React compatibility. Auto-reconnects with exponential backoff.

### Streaming Architecture (`src/streaming/`)

**`streamManager.ts`** maintains one WebSocket connection per account. Key behaviors:
- User stream subscription covers both home timeline and notifications
- List/hashtag streams are separate subscriptions
- Reconnects on page visibility changes
- Calls into streams store to prepend new statuses/notifications

### UI Component Hierarchy

```
App.tsx
├── Sidebar (account list, compose button)
├── ColumnContainer
│   └── Column[] (320px fixed width, horizontal scroll)
│       ├── StatusCard[] / NotificationCard[]
│       └── Infinite scroll via IntersectionObserver
├── LoginModal (OAuth OOB flow)
├── AddColumnModal (account + stream type selection)
└── ComposeModal (account selector for new posts, locked for replies)
```

### Authentication Flow

OAuth 2.0 Out-of-Band (OOB) flow in `src/auth/`:
1. `registerApp()` - Creates app on instance (cached in localStorage per domain)
2. User visits OAuth URL, copies authorization code
3. `exchangeCodeForToken()` - Gets access token
4. `verifyCredentials()` - Fetches account info
5. Session stored with `createSession()`

### Key Utilities

- `src/utils/snakeToCamel.ts` - Converts Mastodon streaming API snake_case responses to camelCase for TypeScript types

### Stream Types

Supported column types: `home`, `public`, `public:local`, `list`, `hashtag`, `notifications`

Stream key examples:
- `123@mastodon.social:home`
- `123@mastodon.social:list:456`
- `123@mastodon.social:hashtag:typescript`

### StatusCard Optimistic UI

StatusCard maintains local state for favorite/reblog counts. API calls update optimistically, with server response as the authoritative source. Uses refs to handle concurrent updates.

## Git Policy

### Branch Strategy

* `master`
  * Always maintain working state
  * Direct push prohibited
* `develop`
  * Merge destination for regular work branches
* `feature/*`
  * Feature additions (e.g., `feature/streaming-home`)
* `fix/*`
  * Bug fixes
* `chore/*`
  * Dependency updates, configuration changes

Agents **must always work on feature/fix branches**.

---

### Commit Rules

* Small, meaningful commit units
* 1 commit = 1 intention
* Breaking changes prohibited (unless separately agreed upon)

Recommended format:

* feat: add home timeline streaming
* fix: handle reconnect on ws close
* refactor: extract stream manager
* test: add oauth oob tests
* chore: update deps

## Testing Policy

### Required

* **Logic must always be separated into testable units**
* Do not tightly couple UI and API logic

Recommended tools:

* Vitest
* Testing Library (UI)

### Test Rules for Agents

* When adding new logic, **write at least one test**
* For fixes: **reproduction test → fix**
* Untestable design is prohibited

## CI Expectations

Write code assuming CI exists.

Minimum requirements:

* `npm run build` passes
* `npm run test` passes
* `npm run format:check` passes
* `npm run lint` passes
* No type errors