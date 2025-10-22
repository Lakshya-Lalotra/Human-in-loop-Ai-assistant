/**
 * Database types for the human-in-the-loop system
 */

export enum HelpRequestStatus {
  PENDING = 'pending',
  RESOLVED = 'resolved',
  TIMEOUT = 'timeout',
}

export interface HelpRequest {
  id: string;
  customerPhone: string;
  customerName?: string;
  question: string;
  context?: string; 
  status: HelpRequestStatus;
  createdAt: string;
  resolvedAt?: string;
  supervisorAnswer?: string;
  timeoutAt: string; // Auto-timeout after 1 hour
}

export interface KnowledgeEntry {
  id: string;
  question: string; // Normalized question
  answer: string;
  category?: string;
  createdAt: string;
  updatedAt: string;
  source: 'initial' | 'learned'; 
}

export interface CallSession {
  id: string;
  customerPhone: string;
  startedAt: string;
  endedAt?: string;
  helpRequestIds: string[];
}

export interface PendingFollowUp {
  id: string;
  customerPhone: string;
  message: string;
  createdAt: string;
  deliveredAt?: string;
}

