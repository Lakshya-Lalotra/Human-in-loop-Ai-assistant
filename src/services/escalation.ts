/**
 * Escalation service for handling questions the AI can't answer
 */

import { createHelpRequest } from '../database/store.js';
import { HelpRequestStatus } from '../database/types.js';
import { createNotificationService } from './notification.js';

const notificationService = createNotificationService();

// Start polling for supervisor responses when the service is imported
if (notificationService.startSupervisorResponsePolling) {
  notificationService.startSupervisorResponsePolling();
}

export interface EscalationContext {
  customerPhone: string;
  customerName?: string;
  question: string;
  conversationContext?: string;
}

/**
 * Escalate a question to a human supervisor
 * Returns the help request ID
 */
export async function escalateToSupervisor(
  context: EscalationContext,
): Promise<string> {
  // Create help request
  const requestData: any = {
    customerPhone: context.customerPhone,
    question: context.question,
    status: HelpRequestStatus.PENDING,
  };
  
  if (context.customerName) {
    requestData.customerName = context.customerName;
  }
  if (context.conversationContext) {
    requestData.context = context.conversationContext;
  }
  
  const helpRequest = await createHelpRequest(requestData);

  // Notify supervisor
  await notificationService.notifySupervisor(helpRequest);

  console.log(`[Escalation] Created help request ${helpRequest.id} for question: "${context.question}"`);
  
  return helpRequest.id;
}

/**
 * Follow up with a customer after supervisor responds
 */
export async function followUpWithCustomer(
  customerPhone: string,
  answer: string,
): Promise<void> {
  const message = `Hi! I got an answer to your question: ${answer}`;
  await notificationService.notifyCustomer(customerPhone, message);
  
  console.log(`[Follow-up] Sent answer to ${customerPhone}`);
}

