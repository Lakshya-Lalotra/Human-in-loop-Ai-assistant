# Testing Guide

## Quick System Verification

### 1. Verify Knowledge Base
```bash
# Check that 5 entries were created
cat data/knowledge-base.json
# or on Windows:
type data\knowledge-base.json
```

You should see 5 salon information entries.

### 2. Test Supervisor UI

Start the UI:
```bash
pnpm run supervisor
```

Visit http://localhost:3001 and verify:
-  Dashboard loads
-  Shows "0 Pending Requests"
-  Shows "5 Knowledge Entries"
-  Knowledge Base tab shows 5 initial entries

### 3. Test AI Agent

In a separate terminal:
```bash
pnpm run dev
```

Look for:
```
[Agent] Loaded 5 knowledge base entries
Agent registered: agent-starter-node
```

### 4. End-to-End Test

#### Option A: Using LiveKit Playground (Easiest)

1. Go to your LiveKit Cloud dashboard: https://cloud.livekit.io/
2. Navigate to your project
3. Click "Playground" or "Agents"
4. Create a test room or join existing one
5. The agent should automatically join

**Test Questions**:
```
You: "What are your business hours?"
AI: Should answer immediately with hours

You: "Do you offer wedding hair packages?"
AI: "Let me check with my supervisor and get back to you"
```

6. Check supervisor UI - should see new pending request
7. Answer the question in the UI
8. Check console - should see customer follow-up notification
9. Ask the same question again - AI should now know the answer!

#### Option B: Using React Frontend

```bash
cd ..
git clone https://github.com/livekit-examples/agent-starter-react.git
cd agent-starter-react
npm install

# Add your LiveKit credentials to .env.local
echo "LIVEKIT_URL=wss://my-first-project-bhokxdjo.livekit.cloud" >> .env.local
echo "LIVEKIT_API_KEY=APIB4RYbvhAUnQH" >> .env.local
echo "LIVEKIT_API_SECRET=lbCl4kBOuev5303gNEPW5beSfn3jhEs10rthzSErXWtA" >> .env.local

npm run dev
```

Then follow the same test questions as above.

## Test Scenarios

### Scenario 1: Known Information ✅
**Question**: "What services do you offer?"

**Expected**:
1. AI searches knowledge base
2. Finds answer immediately
3. Responds with services list
4. No escalation

**Verify**:
- Check agent logs: `[Knowledge Search] Found answer`
- No new requests in supervisor UI

---

### Scenario 2: Unknown Information ✅
**Question**: "Do you have parking available?"

**Expected**:
1. AI searches knowledge base
2. Doesn't find answer
3. Uses `requestHelp` tool
4. Tells customer "Let me check with my supervisor"

**Verify**:
- Check agent logs: `[Request Help] Escalating`
- Supervisor UI shows new pending request
- Request includes the question

---

### Scenario 3: Supervisor Responds ✅
1. Find pending request in UI
2. Type answer: "Yes, we have free parking in the lot behind our building"
3. Click "Send Answer"

**Expected**:
- Request marked as resolved
- Console shows customer follow-up notification
- Knowledge base updated (check Knowledge Base tab)

**Verify**:
```bash
cat data/knowledge-base.json | grep "parking"
```

---

### Scenario 4: AI Learns ✅
**Question**: "Do you have parking available?" (ask again)

**Expected**:
- AI now knows the answer
- Responds immediately
- No escalation needed

**Verify**:
- Check agent logs: `[Knowledge Search] Found answer`
- No new pending request

---

## Testing Checklist

- [ ] Database initialized (5 knowledge entries)
- [ ] Supervisor UI loads at http://localhost:3001
- [ ] Agent starts without errors
- [ ] AI answers known questions
- [ ] AI escalates unknown questions
- [ ] Supervisor sees pending requests
- [ ] Supervisor can respond to requests
- [ ] Customer follow-up notification appears
- [ ] Knowledge base updates with new answer
- [ ] AI uses learned knowledge on repeat questions

## Common Issues

### Agent won't connect
**Problem**: LiveKit credentials invalid

**Solution**: 
1. Check `.env.local` has correct credentials
2. Verify credentials in LiveKit Cloud dashboard
3. Ensure URL starts with `wss://`

### UI shows "Failed to fetch"
**Problem**: API server not running

**Solution**:
```bash
pnpm run supervisor
```

### "Knowledge search failed"
**Problem**: Database not initialized

**Solution**:
```bash
pnpm run init-db
```

### Models not found
**Problem**: Haven't downloaded AI models

**Solution**:
```bash
pnpm run download-files
```

## Manual Testing Script

Here's a complete test session you can follow:

```bash
# Terminal 1: Start UI
pnpm run supervisor

# Terminal 2: Start Agent
pnpm run dev

# Browser: Open http://localhost:3001

# Frontend: Connect to room

# Test 1: Known question
Ask: "What are your hours?"
Verify: AI answers immediately

# Test 2: Unknown question  
Ask: "Do you offer gift certificates?"
Verify: AI escalates

# Browser: Check UI
Verify: New pending request appears

# Browser: Respond
Answer: "Yes, gift certificates available in any amount"
Click: Send Answer

# Console: Check notification
Verify: Customer follow-up logged

# Browser: Knowledge Base tab
Verify: New entry for gift certificates

# Test 3: Repeat question
Ask: "Do you offer gift certificates?"
Verify: AI knows answer now!
```

## Performance Benchmarks

Expected response times:
- Knowledge base search: < 10ms
- Help request creation: < 50ms
- Supervisor UI load: < 200ms
- AI response (known): 2-4 seconds
- AI response (escalate): 3-5 seconds

## Debugging

Enable verbose logging:
```typescript
// In agent.ts, add:
console.log('Debug:', JSON.stringify(data, null, 2));
```

Check database state:
```bash
# View all requests
cat data/help-requests.json

# View knowledge
cat data/knowledge-base.json

# View sessions
cat data/call-sessions.json
```

Clear database (start fresh):
```bash
rm -rf data/
pnpm run init-db
```

## Video Demo Checklist

When recording your demo video:

- [ ] Show dashboard before any calls (empty pending)
- [ ] Make first call - ask known question
- [ ] Show AI answering correctly
- [ ] Make second call - ask unknown question
- [ ] Show AI saying "let me check with supervisor"
- [ ] Switch to browser, show new pending request
- [ ] Type answer and submit
- [ ] Show console log of follow-up
- [ ] Show knowledge base tab with new entry
- [ ] Make third call - ask same unknown question
- [ ] Show AI now knows the answer!
- [ ] Briefly show code structure
- [ ] Mention 1-2 design decisions
- [ ] Mention what you'd improve

Total time: 4-5 minutes

## Success Criteria

✅ System is working if:
1. Agent connects to LiveKit
2. AI answers known questions correctly
3. AI escalates unknown questions
4. Supervisor can view and respond to requests
5. Knowledge base updates automatically
6. AI learns from supervisor responses
7. No errors in console during normal operation

Happy testing! 🚀

