let currentTab = 'pending';

function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById(`${tab}-tab`).classList.add('active');
    
    refreshData();
}

async function refreshData() {
    await Promise.all([
        loadPendingRequests(),
        loadAllRequests(),
        loadKnowledge()
    ]);
}

async function loadPendingRequests() {
    try {
        const requests = await fetch('/api/help-requests/pending').then(r => r.json());
        const container = document.getElementById('pending-requests');
        
        if (requests.length === 0) {
            container.innerHTML = '<div class="empty-state">No pending requests</div>';
            return;
        }

        container.innerHTML = requests.map(req => renderRequest(req, true)).join('');
    } catch (error) {
        console.error('Error loading pending requests:', error);
    }
}

async function loadAllRequests() {
    try {
        const requests = await fetch('/api/help-requests').then(r => r.json());
        const container = document.getElementById('all-requests');
        
        if (requests.length === 0) {
            container.innerHTML = '<div class="empty-state">No requests yet</div>';
            return;
        }

        // Sort by creation date, newest first
        requests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        container.innerHTML = requests.map(req => renderRequest(req, false)).join('');
    } catch (error) {
        console.error('Error loading all requests:', error);
    }
}

function renderRequest(req, showForm) {
    const createdDate = new Date(req.createdAt).toLocaleString();

    return `
        <div class="request-card">
            <div class="request-question">${req.question}</div>
            <div class="request-meta">
                Phone: ${req.customerPhone} | ${createdDate} | 
                <span class="badge ${req.status}">${req.status.toUpperCase()}</span>
            </div>
            ${req.supervisorAnswer ? `<div><strong>Answer:</strong> ${req.supervisorAnswer}</div>` : ''}
            ${showForm && req.status === 'pending' ? `
                <form onsubmit="submitResponse(event, '${req.id}')">
                    <textarea name="answer" required placeholder="Your answer..."></textarea>
                    <button type="submit">Send Answer</button>
                </form>
            ` : ''}
        </div>
    `;
}

async function submitResponse(event, requestId) {
    event.preventDefault();
    const form = event.target;
    const answer = form.answer.value;

    try {
        const response = await fetch(`/api/help-requests/${requestId}/respond`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answer })
        });

        if (response.ok) {
            alert('Answer sent!');
            refreshData();
        } else {
            alert('Error sending answer.');
        }
    } catch (error) {
        console.error('Error submitting response:', error);
        alert('Error sending answer.');
    }
}

async function loadKnowledge() {
    try {
        const knowledge = await fetch('/api/knowledge').then(r => r.json());
        const tbody = document.getElementById('knowledge-list');
        
        if (knowledge.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No knowledge entries yet</td></tr>';
            return;
        }

        // Sort by date, newest first
        knowledge.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        tbody.innerHTML = knowledge.map(entry => `
            <tr>
                <td><strong>${entry.question}</strong></td>
                <td>${entry.answer}</td>
                <td>${entry.source}</td>
                <td>${new Date(entry.createdAt).toLocaleDateString()}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading knowledge:', error);
    }
}

// Auto-refresh every 30 seconds
setInterval(refreshData, 30000);

// Initial load
refreshData();


