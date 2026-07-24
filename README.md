# DearPal WhatsApp Service

Production-ready WhatsApp Cloud API integration — the messaging foundation for DearPal's healthcare AI pipeline.

## Overview

This service provides:

- **WhatsApp Cloud API integration** — send/receive text and voice messages
- **Webhook verification** — Meta webhook handshake
- **Media download** — download audio files from WhatsApp
- **Message processing pipeline** — modular architecture ready for AI integration
- **Conversation metadata tracking** — in-memory store (database-ready interface)
- **Scaffolded AI services** — interfaces and mocks for Sarvam STT, embeddings, RAG, risk assessment, and decision engine

## Architecture

```
WhatsApp User → Meta Cloud API → Express Server
                                      │
                                 Middleware (Helmet, CORS, Rate Limit, Logger)
                                      │
                                 WebhookController (thin — no business logic)
                                      │
                                 MessageProcessor (orchestrator)
                                      │
                            ┌─────────┼─────────┐
                            │                    │
                      TextProcessor       VoiceProcessor
                            │                    │
                            └──── AI Pipeline ───┘  ← Phase 2
                                      │
                            ┌─────────┼─────────┐
                            │    │    │    │     │
                           STT  Emb  RAG Risk Decision
```

### Key Design Decisions

- **Dependency Injection** — Simple service container (`src/container.ts`) for swapping mock → real implementations
- **Interface-driven** — All AI services and the conversation store implement interfaces
- **Fire-and-forget** — Webhook responds 200 immediately; processing runs async
- **Configurable responses** — All reply messages in `src/config/messages.ts`
- **Phase 2 ready** — AI pipeline, vector DB, storage, and queue services scaffolded

## Prerequisites

- **Node.js** 18.0+ ([download](https://nodejs.org/))
- **Meta Developer Account** with WhatsApp Business API access
- **WhatsApp Business API** phone number and access token

## Setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd PALAI
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
PORT=3000
NODE_ENV=development
META_ACCESS_TOKEN=your_meta_access_token
VERIFY_TOKEN=your_webhook_verify_token
PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_API_VERSION=v23.0
```

### 3. Run Development Server

```bash
npm run dev
```

The server starts at `http://localhost:3000`.

### 4. Verify Setup

```bash
# Health check
curl http://localhost:3000/health

# Webhook verification (test)
curl "http://localhost:3000/webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test123"
```

## API Endpoints

| Method | Endpoint   | Description                        |
| ------ | ---------- | ---------------------------------- |
| GET    | `/health`  | Health check                       |
| GET    | `/webhook` | Meta webhook verification          |
| POST   | `/webhook` | Receive incoming WhatsApp messages |

## Project Structure

```
src/
├── config/
│   ├── index.ts              # Environment config (fail-fast validation)
│   ├── messages.ts           # Configurable response templates
│   └── ai.ts                 # AI service config (Phase 2 placeholders)
├── controllers/
│   └── webhook.controller.ts # Thin controller — delegates to processors
├── routes/
│   ├── index.ts              # Route aggregator + health check
│   └── webhook.routes.ts     # GET/POST /webhook
├── services/
│   ├── whatsapp/
│   │   └── whatsapp.service.ts   # Pure WhatsApp API client
│   ├── processing/
│   │   ├── message.processor.ts  # Orchestrator
│   │   ├── text.processor.ts     # Text message handler
│   │   └── voice.processor.ts    # Voice message handler
│   ├── ai/
│   │   ├── interfaces.ts             # AI service contracts
│   │   ├── ai-pipeline.service.ts    # Pipeline orchestrator
│   │   ├── sarvam-speech.service.ts  # Mock STT
│   │   ├── embedding.service.ts      # Mock embeddings
│   │   ├── rag.service.ts            # Mock RAG
│   │   ├── risk-assessment.service.ts # Mock risk
│   │   └── decision-engine.service.ts # Mock decisions
│   ├── vector/
│   │   └── vector.service.ts    # Placeholder
│   ├── storage/
│   │   └── storage.service.ts   # Placeholder
│   └── queue/
│       └── queue.service.ts     # Placeholder
├── store/
│   └── conversation.store.ts   # IConversationStore + MemoryConversationStore
├── types/
│   ├── whatsapp.types.ts       # WhatsApp API types
│   ├── processing.types.ts     # Processing & AI types
│   └── index.ts                # Barrel exports
├── utils/
│   ├── logger.ts               # Winston logger
│   └── helpers.ts              # Parsing & validation
├── middleware/
│   ├── error.middleware.ts     # Global error handler
│   ├── requestLogger.middleware.ts  # Response time logging
│   └── validation.middleware.ts     # Payload validation
├── container.ts                # DI service container
├── app.ts                      # Express app setup
└── server.ts                   # Entry point
```

## Scripts

| Script           | Description                          |
| ---------------- | ------------------------------------ |
| `npm run dev`    | Start dev server with hot reload     |
| `npm run build`  | Compile TypeScript to `dist/`        |
| `npm start`      | Run compiled production build        |
| `npm run lint`   | Run ESLint                           |
| `npm run format` | Format code with Prettier            |
| `npm run typecheck` | Type-check without emitting       |

## Docker

### Build

```bash
docker build -t dearpal-whatsapp .
```

### Run

```bash
docker run -d \
  --name dearpal-whatsapp \
  -p 3000:3000 \
  --env-file .env \
  dearpal-whatsapp
```

## Environment Variables

| Variable                | Required | Default    | Description                          |
| ----------------------- | -------- | ---------- | ------------------------------------ |
| `PORT`                  | No       | `3000`     | Server port                          |
| `NODE_ENV`              | No       | `development` | Environment                       |
| `META_ACCESS_TOKEN`     | **Yes**  | —          | WhatsApp Cloud API access token      |
| `VERIFY_TOKEN`          | **Yes**  | —          | Webhook verification token           |
| `PHONE_NUMBER_ID`       | **Yes**  | —          | WhatsApp phone number ID             |
| `WHATSAPP_API_VERSION`  | No       | `v23.0`    | WhatsApp API version                 |
| `LOG_LEVEL`             | No       | `info`     | Winston log level                    |
| `AI_PIPELINE_ENABLED`   | No       | `false`    | Enable AI pipeline (Phase 2)         |

## Swapping Mock Services (Phase 2)

To replace a mock service with a real implementation:

1. Create the real service implementing the same interface
2. Update the getter in `src/container.ts`
3. No changes needed in processors, controllers, or routes

Example — replacing the speech service:

```typescript
// src/container.ts
get speechService(): ISpeechService {
  // Phase 1: Mock
  // return new SarvamSpeechService();

  // Phase 2: Real Sarvam AI
  return new RealSarvamSpeechService(aiConfig.sarvam);
}
```

## License

UNLICENSED — Proprietary
