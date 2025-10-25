# Glamour Salon - AI Receptionist with Human-in-the-Loop

A voice AI receptionist system for a salon that can intelligently escalate to human supervisors when it doesn't know the answer, learn from their responses, and follow up with customers automatically.

Built with LiveKit Agents (Node.js), this project demonstrates a practical human-in-the-loop AI system that improves over time.

## 🎯 Project Overview

This system implements:
- **AI Voice Agent**: Answers calls about salon services, hours, pricing, and location
- **Smart Escalation**: Automatically escalates unknown questions to human supervisors
- **Human Supervisor UI**: Web dashboard for supervisors to view and respond to help requests
- **Knowledge Base Learning**: Automatically updates the AI's knowledge base when supervisors answer questions
- **Customer Follow-up**: Notifies customers when their questions are answered
- **Request Lifecycle Management**: Tracks requests from pending → resolved/timeout

## 🏗️ Architecture & Design Decisions

### Database Design

**Choice**: Simple JSON file storage (`data/*.json`)
- **Why**: Fast iteration, no external dependencies, easy to inspect
- **Production alternative**: DynamoDB, PostgreSQL, or Firebase
- **Scalability**: For 10-1000 requests/day, this is sufficient. Above that, migrate to a real database with indexing

**Data Models**:

1. **HelpRequest**: Tracks questions escalated to supervisors
   ```typescript
   {
     id: string
     customerPhone: string
     question: string
     status: 'pending' | 'resolved' | 'timeout'
     supervisorAnswer?: string
     timeoutAt: string  // Auto-timeout after 1 hour
   }
   ```

2. **KnowledgeEntry**: AI's knowledge base
   ```typescript
   {
     id: string
     question: string
     answer: string
     source: 'initial' | 'learned'  // Track learning
     createdAt: string
   }
   ```

### Request Lifecycle

```
Customer asks unknown question
        ↓
AI uses requestHelp tool
        ↓
Create HelpRequest (status: pending)
        ↓
Notify supervisor (console/webhook)
        ↓
[Wait for supervisor response or timeout]
        ↓
Supervisor responds via UI
        ↓
Update HelpRequest (status: resolved)
        ↓
Add to Knowledge Base
        ↓
Notify customer with answer
```

**Timeout Handling**: Requests auto-timeout after 1 hour. The system checks timeouts when fetching pending requests, marking expired ones as 'timeout'.

### Agent Design

**Tools Provided to AI**:
1. `searchKnowledge`: Query the knowledge base
2. `requestHelp`: Escalate to human supervisor

**Why this approach**:
- Simple and predictable
- AI explicitly decides when to escalate
- Clear separation between known/unknown information
- Prevents hallucination by giving AI an "I don't know" option

### Supervisor UI

**Choice**: Lightweight Express + vanilla JavaScript
- **Why**: No build step, works immediately, easy to understand
- **Features**:
  - Real-time dashboard with auto-refresh
  - Pending/resolved request views
  - Knowledge base browser
  - One-click response with automatic follow-up

### Notification System

**Current**: Console-based (for development)
**Production-ready**: Webhook integration for Twilio/SMS

```typescript
interface NotificationService {
  notifySupervisor(request: HelpRequest): Promise<void>
  notifyCustomer(phone: string, message: string): Promise<void>
}
```

Easily swap implementations without changing business logic.

### Scaling Considerations

**Current (10-100 requests/day)**:
- ✅ JSON file storage
- ✅ Single server instance
- ✅ In-memory operations

**Medium Scale (100-1000 requests/day)**:
- → Add database connection pooling
- → Implement caching layer (Redis)
- → Add proper logging/monitoring

**High Scale (1000+ requests/day)**:
- → Migrate to PostgreSQL/DynamoDB
- → Add message queue (SQS/RabbitMQ) for notifications
- → Implement worker pool for concurrent requests
- → Add load balancer for multiple agent instances

## 🚀 Setup Instructions

### Prerequisites

- Node.js >= 22.0.0
- pnpm >= 10.0.0
- LiveKit Cloud account (free tier works)

### Installation

1. **Clone and install dependencies**:
```bash
git clone https://github.com/Lakshya-Lalotra/Human-in-loop-Ai-assistant
pnpm install
```

2. **Set up LiveKit credentials**:
   - Sign up at [LiveKit Cloud](https://cloud.livekit.io/)
   - Get your credentials from the dashboard
   - create new file in root with name `.env.local`:
   ```env
   LIVEKIT_URL=wss://your-project.livekit.cloud
   LIVEKIT_API_KEY=your_api_key
   LIVEKIT_API_SECRET=your_api_secret
   ```

3. **Initialize the knowledge base**:
   ```bash
   pnpm run init-db
   ```

4. **Download required AI models**:
   ```bash
   pnpm run download-files
   ```

### Running the System

**Option 1: Run everything together (recommended for development)**:
```bash
pnpm run dev:all
```

This starts:
- AI agent on LiveKit
- Supervisor UI at http://localhost:3001

**Option 2: Run separately**:

Terminal 1 - Supervisor UI:
```bash
pnpm run supervisor
```

Terminal 2 - AI Agent:
```bash
pnpm run dev
```

### Testing the System

1. **Open Supervisor UI**: http://localhost:3001

2. **Connect a frontend**: Use one of LiveKit's starter frontends:
   - [React Web App](https://github.com/livekit-examples/agent-starter-react)
   - [Flutter App](https://github.com/livekit-examples/agent-starter-flutter)
   - Or test via LiveKit Playground in your cloud dashboard

3. **Test Scenarios**:
   - Ask: "What are your hours?" → AI knows this
   - Ask: "Do you offer wedding hair packages?" → AI escalates to supervisor
   - Check supervisor UI for the new request
   - Answer the question in the UI
   - Watch the console for customer follow-up notification

## 📂 Project Structure

```
src/
├── agent.ts                    # Main AI agent with LiveKit integration
├── database/
│   ├── types.ts               # Data model definitions
│   ├── store.ts               # JSON file storage implementation
│   ├── seed.ts                # Initial knowledge base data
│   └── init.ts                # Database initialization script
├── services/
│   ├── escalation.ts          # Help request creation & follow-up
│   └── notification.ts        # Supervisor/customer notifications
└── supervisor-ui/
    ├── server.ts              # Express API server
    └── public/
        └── index.html         # Supervisor dashboard UI

data/                          # Runtime data (created automatically)
├── help-requests.json
├── knowledge-base.json
└── call-sessions.json
```

## 🔧 Key Features

### 1. AI Agent Capabilities
- Voice conversation using OpenAI GPT-4.1-mini (LLM)
- Speech-to-text with AssemblyAI
- Text-to-speech with Cartesia
- Salon-specific knowledge base
- Smart escalation when uncertain

### 2. Help Request Management
- Automatic request creation on escalation
- Unique request IDs for tracking
- 1-hour auto-timeout for pending requests
- Status tracking: pending → resolved/timeout

### 3. Supervisor Dashboard
- View all pending requests
- Historical request log
- One-click response interface
- Knowledge base browser
- Auto-refresh every 30 seconds

### 4. Knowledge Base
- Pre-seeded with salon information
- Automatically updated when supervisor responds
- Tracks source (initial vs. learned)
- Simple keyword search (can be upgraded to semantic search)

### 5. Customer Follow-up
- Automatic notification when question is answered
- Console-based (development)
- Webhook-ready for SMS integration (production)

## 🎨 Design Principles

1. **Simplicity First**: Clean, readable code over clever abstractions
2. **Modularity**: Easy to swap components (database, notifications, etc.)
3. **Production-Ready**: Proper error handling, typed interfaces
4. **Scalable Design**: Clear upgrade path as volume grows
5. **Human-Centered**: UI optimized for supervisor efficiency

## 🔮 Future Improvements

### Short Term
- [ ] Add semantic search for knowledge base (embeddings)
- [ ] Implement Twilio integration for real SMS
- [ ] Add authentication for supervisor UI
- [ ] Export reports (CSV/PDF)

### Medium Term
- [ ] Multi-supervisor support with assignment
- [ ] Response templates for common answers
- [ ] Analytics dashboard (response times, common questions)
- [ ] Slack integration for supervisor notifications

### Long Term
- [ ] ML-powered answer suggestions based on similar past questions
- [ ] Voice recording storage for quality assurance
- [ ] Multi-language support
- [ ] Integration with booking systems

## 🔍 Smart Search Algorithm

The knowledge base uses an intelligent search system with:

- **Synonym Mapping**: "price" ↔ "cost", "color" ↔ "coloring", "hair" ↔ "haircut"
- **Scoring System**: Prioritizes exact matches, learned entries, and category relevance
- **Partial Matching**: Handles variations like "hair color price" → "hair coloring cost"
- **Learning Priority**: Learned entries get bonus points for better matching

This ensures the AI finds the most relevant answers, especially for supervisor-learned information.

## 🛠️ Technology Stack

- **Framework**: LiveKit Agents (Node.js)
- **Language**: TypeScript
- **AI Models**: 
  - LLM: OpenAI GPT-4.1-mini
  - STT: AssemblyAI Universal Streaming
  - TTS: Cartesia Sonic 2
- **UI**: Express + vanilla JavaScript (no build step)
- **Database**: JSON files (development), ready for PostgreSQL/DynamoDB
- **Runtime**: Node.js 22+


### Monitoring
- Console logs for all major operations
- Request IDs for tracing
- Usage metrics via LiveKit


## 📄 License

MIT License - See LICENSE file for details.

