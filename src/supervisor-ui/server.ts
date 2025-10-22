/**
 * Simple Express server for the supervisor UI
 * Provides a web interface for viewing and responding to help requests
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getAllHelpRequests,
  getPendingHelpRequests,
  updateHelpRequest,
  getAllKnowledge,
  addKnowledge,
} from '../database/store.js';
import { HelpRequestStatus } from '../database/types.js';
import { followUpWithCustomer } from '../services/escalation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.SUPERVISOR_UI_PORT || 3001;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// API Routes

// Get all help requests
app.get('/api/help-requests', async (req, res) => {
  try {
    const requests = await getAllHelpRequests();
    res.json(requests);
  } catch (error) {
    console.error('Error fetching help requests:', error);
    res.status(500).json({ error: 'Failed to fetch help requests' });
  }
});

// Get pending help requests
app.get('/api/help-requests/pending', async (req, res) => {
  try {
    const requests = await getPendingHelpRequests();
    res.json(requests);
  } catch (error) {
    console.error('Error fetching pending requests:', error);
    res.status(500).json({ error: 'Failed to fetch pending requests' });
  }
});

// Respond to a help request
app.post('/api/help-requests/:id/respond', async (req, res) => {
  try {
    const { id } = req.params;
    const { answer } = req.body;

    if (!answer) {
      return res.status(400).json({ error: 'Answer is required' });
    }

    // Update the help request
    const updatedRequest = await updateHelpRequest(id, {
      status: HelpRequestStatus.RESOLVED,
      supervisorAnswer: answer,
      resolvedAt: new Date().toISOString(),
    });

    if (!updatedRequest) {
      return res.status(404).json({ error: 'Help request not found' });
    }

    // Add to knowledge base
    await addKnowledge({
      question: updatedRequest.question,
      answer,
      source: 'learned',
      category: 'supervisor-learned',
    });

    // Follow up with customer
    await followUpWithCustomer(updatedRequest.customerPhone, answer);

    return res.json({ success: true, request: updatedRequest });
  } catch (error) {
    console.error('Error responding to request:', error);
    return res.status(500).json({ error: 'Failed to respond to request' });
  }
});

// Get knowledge base
app.get('/api/knowledge', async (req, res) => {
  try {
    const knowledge = await getAllKnowledge();
    res.json(knowledge);
  } catch (error) {
    console.error('Error fetching knowledge:', error);
    res.status(500).json({ error: 'Failed to fetch knowledge' });
  }
});

// Webhook endpoint for notifications
app.post('/webhook/supervisor-notify', async (req, res) => {
  console.log('Webhook received:', req.body);
  res.json({ success: true });
});

// Serve the UI
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

export function startSupervisorUI() {
  app.listen(PORT, () => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Supervisor UI running at http://localhost:${PORT}`);
    console.log(`${'='.repeat(60)}\n`);
  });
}

// Start the server when this file is run directly
startSupervisorUI();

