/**
 * Session Manager - Tracks active LiveKit sessions
 * Allows the system to send follow-up messages to customers in real-time
 */

import type { voice } from '@livekit/agents';

interface ActiveSession {
  customerPhone: string;
  session: voice.AgentSession;
  roomName: string;
  connectedAt: string;
}

class SessionManager {
  private activeSessions: Map<string, ActiveSession> = new Map();
  
  /**
   * Register an active session
   */
  registerSession(customerPhone: string, session: voice.AgentSession, roomName: string): void {
    console.log(`[SessionManager] Registering session for ${customerPhone} in room ${roomName}`);
    this.activeSessions.set(customerPhone, {
      customerPhone,
      session,
      roomName,
      connectedAt: new Date().toISOString(),
    });
  }
  
  /**
   * Unregister a session when it ends
   */
  unregisterSession(customerPhone: string): void {
    console.log(`[SessionManager] Unregistering session for ${customerPhone}`);
    this.activeSessions.delete(customerPhone);
  }
  
  /**
   * Check if a session is still active and healthy
   */
  isSessionActive(customerPhone: string): boolean {
    const session = this.activeSessions.get(customerPhone);
    if (!session) return false;
    
    // Check if the session is still valid
    try {
      // This is a simple check - in a real implementation you might want to ping the session
      return true;
    } catch (error) {
      console.log(`[SessionManager] Session for ${customerPhone} is no longer healthy`);
      this.unregisterSession(customerPhone);
      return false;
    }
  }
  
  /**
   * Get an active session by customer phone
   */
  getSession(customerPhone: string): ActiveSession | undefined {
    return this.activeSessions.get(customerPhone);
  }
  
  /**
   * Send a message to a customer if they're still connected
   */
  async sendMessageToCustomer(customerPhone: string, message: string): Promise<boolean> {
    const activeSession = this.activeSessions.get(customerPhone);
    
    if (!activeSession) {
      console.log(`[SessionManager] No active session for ${customerPhone}`);
      return false;
    }
    
    try {
      console.log(`[SessionManager] Sending message to ${customerPhone}: "${message}"`);
      await activeSession.session.say(message);
      console.log(`[SessionManager] Successfully sent message to ${customerPhone}`);
      return true;
    } catch (error) {
      console.error(`[SessionManager] Error sending message to ${customerPhone}:`, error);
      // If there's an error, the session might be dead, so unregister it
      this.unregisterSession(customerPhone);
      return false;
    }
  }
  
  /**
   * Get all active sessions
   */
  getAllActiveSessions(): ActiveSession[] {
    return Array.from(this.activeSessions.values());
  }
  
  /**
   * Get count of active sessions
   */
  getActiveSessionCount(): number {
    return this.activeSessions.size;
  }
}

// Export a singleton instance
export const sessionManager = new SessionManager();

