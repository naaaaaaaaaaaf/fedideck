# FediDeck

A multi-column Mastodon/Fediverse client built with React, TypeScript, Vite, and Zustand. It provides a TweetDeck-style interface for monitoring multiple timelines across multiple accounts and instances.

## Features

- **Multi-column layout** - Monitor multiple timelines side by side
- **Multi-account support** - Connect multiple accounts from different instances
- **Real-time streaming** - WebSocket-based live updates for timelines and notifications
- **OAuth 2.0 authentication** - Secure Out-of-Band (OOB) flow
- **Multiple stream types** - Home, public, local, list, hashtag, and notifications
- **Compose and interact** - Post, reply, favorite, reblog, and more

## Tech Stack

- **React 19** - UI framework
- **TypeScript 5.9** - Type safety
- **Vite 7** - Build tool with HMR
- **Zustand** - State management
- **Vitest** - Testing framework
- **Masto.js** - Mastodon API client

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/fedideck.git
cd fedideck

# Install dependencies
npm install

# Start development server
npm run dev
```

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

# Linting & Formatting
npm run lint          # ESLint check
npm run format        # Format code with Prettier
npm run format:check  # Check code formatting
```

## Architecture

### State Management (Zustand)

Three core stores manage the application state:

- **`accounts.ts`** - Session management for logged-in accounts
- **`columns.ts`** - Column configuration (type, account, params)
- **`streams.ts`** - Runtime timeline/notification data

### Multi-Account Architecture

Each account session contains its own access token and instance URL. Columns are bound to specific accounts via `accountId`. Interactions within a column use that column's account.

### API Layer

- **`mastoClient.ts`** - REST API wrapper using `masto` library
- **`streamingClient.ts`** - Custom WebSocket client for real-time updates with auto-reconnect

### Streaming Architecture

**`streamManager.ts`** maintains one WebSocket connection per account:

- User stream subscription covers both home timeline and notifications
- List/hashtag streams are separate subscriptions
- Auto-reconnects on page visibility changes
- Calls into streams store to prepend new statuses/notifications

### Authentication Flow

OAuth 2.0 Out-of-Band (OOB) flow:

1. `registerApp()` - Creates app on instance (cached in localStorage per domain)
2. User visits OAuth URL, copies authorization code
3. `exchangeCodeForToken()` - Gets access token
4. `verifyCredentials()` - Fetches account info
5. Session stored with `createSession()`

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
├── ComposeModal (new posts, replies, quotes, edits)
├── StatusDetailModal (thread view, interactions)
├── ProfileModal (user profile, posts, followers, following)
├── ImageViewer (image gallery with zoom)
├── VideoViewer (video playback)
├── AudioPlayer (audio playback)
└── ConfirmModal (delete confirmation)
```

## Contributing

1. Create a feature branch from `develop`
2. Make your changes with tests
3. Submit a pull request to `develop`

## License

MIT
