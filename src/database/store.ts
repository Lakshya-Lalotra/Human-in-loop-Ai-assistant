import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import type { HelpRequest, KnowledgeEntry, CallSession, PendingFollowUp } from './types.js';
import { HelpRequestStatus } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../data');

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating data directory:', error);
  }
}

// Generic file operations
async function readJsonFile<T>(filename: string, defaultValue: T): Promise<T> {
  await ensureDataDir();
  const filepath = path.join(DATA_DIR, filename);
  try {
    const data = await fs.readFile(filepath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return defaultValue;
  }
}

async function writeJsonFile<T>(filename: string, data: T): Promise<void> {
  await ensureDataDir();
  const filepath = path.join(DATA_DIR, filename);
  await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf-8');
}

// Help Requests
export async function getAllHelpRequests(): Promise<HelpRequest[]> {
  return readJsonFile<HelpRequest[]>('help-requests.json', []);
}

export async function getHelpRequest(id: string): Promise<HelpRequest | null> {
  const requests = await getAllHelpRequests();
  return requests.find((r) => r.id === id) || null;
}

export async function createHelpRequest(
  request: Omit<HelpRequest, 'id' | 'createdAt' | 'timeoutAt'>,
): Promise<HelpRequest> {
  const requests = await getAllHelpRequests();
  const newRequest: HelpRequest = {
    ...request,
    id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
    timeoutAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour timeout
  };
  requests.push(newRequest);
  await writeJsonFile('help-requests.json', requests);
  return newRequest;
}

export async function updateHelpRequest(
  id: string,
  updates: Partial<HelpRequest>,
): Promise<HelpRequest | null> {
  const requests = await getAllHelpRequests();
  const index = requests.findIndex((r) => r.id === id);
  if (index === -1) return null;

  const updated = { ...requests[index], ...updates } as HelpRequest;
  requests[index] = updated;
  await writeJsonFile('help-requests.json', requests);
  return updated;
}

export async function getPendingHelpRequests(): Promise<HelpRequest[]> {
  const requests = await getAllHelpRequests();
  const now = new Date();
  
  // Auto-timeout expired requests
  let hasChanges = false;
  for (const request of requests) {
    if (request.status === HelpRequestStatus.PENDING && new Date(request.timeoutAt) < now) {
      request.status = HelpRequestStatus.TIMEOUT;
      hasChanges = true;
    }
  }
  
  if (hasChanges) {
    await writeJsonFile('help-requests.json', requests);
  }
  
  return requests.filter((r) => r.status === HelpRequestStatus.PENDING);
}

// Knowledge Base
export async function getAllKnowledge(): Promise<KnowledgeEntry[]> {
  return readJsonFile<KnowledgeEntry[]>('knowledge-base.json', []);
}

export async function searchKnowledge(query: string): Promise<KnowledgeEntry | null> {
  const knowledge = await getAllKnowledge();
  const normalizedQuery = query.toLowerCase().trim();
  
  // Extract meaningful keywords (filter out common words)
  const stopWords = ['the', 'are', 'your', 'what', 'where', 'how', 'can', 'do', 'does', 'is', 'at', 'to', 'of', 'glamour', 'salon'];
  const queryWords = normalizedQuery
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.includes(w));
  
  // Add synonym mapping for better matching
  const synonyms: { [key: string]: string[] } = {
    'price': ['cost', 'pricing', 'fee', 'charge', 'rate'],
    'cost': ['price', 'pricing', 'fee', 'charge', 'rate'],
    'pricing': ['price', 'cost', 'fee', 'charge', 'rate'],
    'color': ['coloring', 'colour', 'colouring'],
    'coloring': ['color', 'colour', 'colouring'],
    'hair': ['haircut', 'hairstyle', 'haircutting'],
    'appointment': ['booking', 'reservation', 'schedule'],
    'booking': ['appointment', 'reservation', 'schedule'],
    'hours': ['time', 'schedule', 'open', 'closed'],
    'location': ['address', 'where', 'find'],
    'services': ['service', 'treatments', 'offerings']
  };
  
  // Expand query words with synonyms
  const expandedQueryWords = new Set(queryWords);
  queryWords.forEach(word => {
    if (synonyms[word]) {
      synonyms[word].forEach(synonym => expandedQueryWords.add(synonym));
    }
  });
  
  // Score all entries and return the best match
  const scoredEntries = knowledge.map((entry) => {
    const normalizedQuestion = entry.question.toLowerCase().trim();
    const category = entry.category?.toLowerCase() || '';
    let score = 0;
    
    // Priority 1: Exact match or substring match (highest score)
    if (normalizedQuestion.includes(normalizedQuery) || normalizedQuery.includes(normalizedQuestion)) {
      score += 100;
    }
    
    // Priority 2: Category match
    if (category && Array.from(expandedQueryWords).some(word => category.includes(word))) {
      score += 50;
    }
    
    // Priority 3: Keyword matching with scoring
    const questionWords = normalizedQuestion.split(/\s+/).filter(w => w.length > 3);
    const matchCount = Array.from(expandedQueryWords).filter(word => questionWords.includes(word)).length;
    const partialMatches = Array.from(expandedQueryWords).filter(queryWord => 
      questionWords.some(questionWord => 
        questionWord.includes(queryWord) || queryWord.includes(questionWord)
      )
    ).length;
    
    // Score based on exact matches (higher weight)
    score += matchCount * 20;
    // Score based on partial matches (lower weight)
    score += partialMatches * 5;
    
    // Bonus for learned entries (more specific)
    if (entry.source === 'learned') {
      score += 10;
    }
    
    return { entry, score };
  }).filter(({ score }) => score > 0);
  
  // Sort by score and return the best match
  scoredEntries.sort((a, b) => b.score - a.score);
  const match = scoredEntries.length > 0 ? scoredEntries[0].entry : null;
  
  return match || null;
}

export async function addKnowledge(
  entry: Omit<KnowledgeEntry, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<KnowledgeEntry> {
  const knowledge = await getAllKnowledge();
  const newEntry: KnowledgeEntry = {
    ...entry,
    id: `kb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  knowledge.push(newEntry);
  await writeJsonFile('knowledge-base.json', knowledge);
  return newEntry;
}

// Call Sessions
export async function getAllSessions(): Promise<CallSession[]> {
  return readJsonFile<CallSession[]>('call-sessions.json', []);
}

export async function createSession(customerPhone: string): Promise<CallSession> {
  const sessions = await getAllSessions();
  const newSession: CallSession = {
    id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    customerPhone,
    startedAt: new Date().toISOString(),
    helpRequestIds: [],
  };
  sessions.push(newSession);
  await writeJsonFile('call-sessions.json', sessions);
  return newSession;
}

export async function updateSession(
  id: string,
  updates: Partial<CallSession>,
): Promise<CallSession | null> {
  const sessions = await getAllSessions();
  const index = sessions.findIndex((s) => s.id === id);
  if (index === -1) return null;

  const updated = { ...sessions[index], ...updates } as CallSession;
  sessions[index] = updated;
  await writeJsonFile('call-sessions.json', sessions);
  return updated;
}


/**
 * Get all pending follow-up messages
 */
export async function getPendingFollowUps(): Promise<PendingFollowUp[]> {
  return readJsonFile<PendingFollowUp[]>('pending-followups.json', []);
}

/**
 * Add a pending follow-up message
 */
export async function addPendingFollowUp(followUp: Omit<PendingFollowUp, 'id' | 'createdAt'>): Promise<PendingFollowUp> {
  const followUps = await getPendingFollowUps();
  
  const newFollowUp: PendingFollowUp = {
    id: `followup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
    ...followUp,
  };
  
  followUps.push(newFollowUp);
  await writeJsonFile('pending-followups.json', followUps);
  return newFollowUp;
}

/**
 * Mark a follow-up as delivered
 */
export async function markFollowUpDelivered(id: string): Promise<void> {
  const followUps = await getPendingFollowUps();
  const index = followUps.findIndex(f => f.id === id);
  
  if (index !== -1) {
    followUps[index]!.deliveredAt = new Date().toISOString();
    await writeJsonFile('pending-followups.json', followUps);
  }
}

/**
 * Get pending follow-ups for a specific customer
 */
export async function getPendingFollowUpsForCustomer(customerPhone: string): Promise<PendingFollowUp[]> {
  const followUps = await getPendingFollowUps();
  return followUps.filter(f => f.customerPhone === customerPhone && !f.deliveredAt);
}

