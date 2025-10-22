/**
 * Notification service for alerting supervisors and following up with customers
 */

import type { HelpRequest } from '../database/types.js';
import { getPendingHelpRequests, updateHelpRequest } from '../database/store.js';
import { HelpRequestStatus } from '../database/types.js';
import { sessionManager } from './session-manager.js';

export interface NotificationService {
  notifySupervisor(request: HelpRequest): Promise<void>;
  notifyCustomer(customerPhone: string, message: string): Promise<void>;
  startSupervisorResponsePolling?(): void;
  stopSupervisorResponsePolling?(): void;
}


export class ConsoleNotificationService implements NotificationService {
  private pollingInterval: NodeJS.Timeout | null = null;
  private isPolling = false;

  async notifySupervisor(request: HelpRequest): Promise<void> {
    console.log('\n' + '='.repeat(60));
    console.log('📱 SUPERVISOR NOTIFICATION');
    console.log('='.repeat(60));
    console.log(`Request ID: ${request.id}`);
    console.log(`Customer: ${request.customerPhone}`);
    console.log(`Question: ${request.question}`);
    if (request.context) {
      console.log(`Context: ${request.context}`);
    }
    console.log(`Created: ${new Date(request.createdAt).toLocaleString()}`);
    console.log('='.repeat(60) + '\n');
  }

  async notifyCustomer(customerPhone: string, message: string): Promise<void> {
    console.log(`\n🔍 Checking if customer ${customerPhone} is in an active call...`);
    
    // Only send if customer is in an active call
    const sentToActiveSession = await sessionManager.sendMessageToCustomer(customerPhone, message);
    
    if (sentToActiveSession) {
      console.log('\n' + '='.repeat(70));
      console.log('✅ SUCCESS! MESSAGE DELIVERED TO CUSTOMER IN ACTIVE CALL');
      console.log('='.repeat(70));
      console.log(`Customer: ${customerPhone}`);
      console.log(`Message: "${message}"`);
      console.log(`Status: ✅ AI immediately spoke the answer to the customer`);
      console.log(`Delivered At: ${new Date().toLocaleString()}`);
      console.log('='.repeat(70));
      console.log('💬 The customer heard this answer DURING the same call!');
      console.log('='.repeat(70) + '\n');
    } else {
      console.log('\n' + '='.repeat(70));
      console.log('❌ CUSTOMER NOT IN ACTIVE CALL');
      console.log('='.repeat(70));
      console.log(`Customer: ${customerPhone}`);
      console.log(`Message: "${message}"`);
      console.log(`Status: Customer disconnected - answer stored in knowledge base`);
      console.log(`Note: Customer will get this answer on their next call`);
      console.log('='.repeat(70) + '\n');
    }
  }

  /**
   * Start polling for supervisor responses
   * This function continuously checks the database for resolved help requests
   * and automatically follows up with customers
   */
  startSupervisorResponsePolling(): void {
    if (this.isPolling) {
      console.log('[Polling] Already polling for supervisor responses');
      return;
    }

    this.isPolling = true;
    console.log('[Polling] Starting supervisor response polling...');

    this.pollingInterval = setInterval(async () => {
      try {
        await this.checkForSupervisorResponses();
      } catch (error) {
        console.error('[Polling] Error checking for supervisor responses:', error);
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Stop polling for supervisor responses
   */
  stopSupervisorResponsePolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      this.isPolling = false;
      console.log('[Polling] Stopped supervisor response polling');
    }
  }

  /**
   * Check for resolved help requests and follow up with customers
   */
  private async checkForSupervisorResponses(): Promise<void> {
    try {
      const pendingRequests = await getPendingHelpRequests();
      
      // Check if any requests have been resolved by supervisor
      for (const request of pendingRequests) {
        // Check if request has been resolved (has supervisorAnswer and resolvedAt)
        if (request.supervisorAnswer && request.resolvedAt) {
          console.log('\n' + '='.repeat(70));
          console.log('🔔 SUPERVISOR ANSWERED A QUESTION!');
          console.log('='.repeat(70));
          console.log(`Request ID: ${request.id}`);
          console.log(`Original Question: "${request.question}"`);
          console.log(`Supervisor Answer: "${request.supervisorAnswer}"`);
          console.log(`Customer Phone: ${request.customerPhone}`);
          console.log(`Resolved At: ${new Date(request.resolvedAt).toLocaleString()}`);
          console.log('='.repeat(70));
          console.log('📞 Attempting to notify customer in active call...');
          console.log('='.repeat(70) + '\n');
          
          // Follow up with customer
          await this.notifyCustomer(request.customerPhone, `Hi! I got an answer to your question: ${request.supervisorAnswer}`);
          
          // Mark as RESOLVED to prevent sending duplicate notifications
          await updateHelpRequest(request.id, { status: HelpRequestStatus.RESOLVED });
          
          console.log(`\n✅ Request ${request.id} marked as RESOLVED\n`);
        }
      }
    } catch (error) {
      console.error('[Polling] Error in checkForSupervisorResponses:', error);
    }
  }

  /**
   * Manually check for a specific request resolution
   */
  async checkRequestResolution(requestId: string): Promise<boolean> {
    try {
      const pendingRequests = await getPendingHelpRequests();
      const request = pendingRequests.find(r => r.id === requestId);
      
      if (request && request.supervisorAnswer && request.resolvedAt) {
        await this.notifyCustomer(request.customerPhone, `Hi! I got an answer to your question: ${request.supervisorAnswer}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[Polling] Error checking request resolution:', error);
      return false;
    }
  }
  
}

/**
 * Webhook-based notification service
 * Can be used to integrate with Twilio, Slack, etc.
 */
export class WebhookNotificationService implements NotificationService {
  constructor(private webhookUrl: string) {}

  async notifySupervisor(request: HelpRequest): Promise<void> {
    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'supervisor_notification',
          request,
        }),
      });
      
      if (!response.ok) {
        console.error('Failed to send supervisor notification:', response.statusText);
      }
    } catch (error) {
      console.error('Error sending supervisor notification:', error);
      // Fallback to console
      await new ConsoleNotificationService().notifySupervisor(request);
    }
  }

  async notifyCustomer(customerPhone: string, message: string): Promise<void> {
    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'customer_notification',
          customerPhone,
          message,
        }),
      });
      
      if (!response.ok) {
        console.error('Failed to send customer notification:', response.statusText);
      }
    } catch (error) {
      console.error('Error sending customer notification:', error);
      // Fallback to console
      await new ConsoleNotificationService().notifyCustomer(customerPhone, message);
    }
  }
}

// Factory function to create the appropriate notification service
export function createNotificationService(): NotificationService {
  const webhookUrl = process.env.SUPERVISOR_WEBHOOK_URL;
  
  if (webhookUrl && webhookUrl !== 'http://localhost:3001/webhook/supervisor-notify') {
    return new WebhookNotificationService(webhookUrl);
  }
  
  return new ConsoleNotificationService();
}

// Export a singleton instance
export const notificationService = createNotificationService();

