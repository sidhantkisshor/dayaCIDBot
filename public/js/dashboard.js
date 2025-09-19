// Dashboard JavaScript

let charts = {};
let eventSource = null;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    feather.replace();
    initCharts();
    loadDashboardData();
    startRealTimeUpdates();
});

// Initialize Charts
function initCharts() {
    // Spam Activity Chart
    const spamCtx = document.getElementById('spamChart').getContext('2d');
    charts.spam = new Chart(spamCtx, {
        type: 'line',
        data: {
            labels: getLast7Days(),
            datasets: [{
                label: 'Messages Blocked',
                data: [0, 0, 0, 0, 0, 0, 0],
                borderColor: 'rgb(239, 68, 68)',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                tension: 0.4
            }, {
                label: 'Total Messages',
                data: [0, 0, 0, 0, 0, 0, 0],
                borderColor: 'rgb(59, 130, 246)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                }
            }
        }
    });

    // Pattern Distribution Chart
    const patternCtx = document.getElementById('patternChart').getContext('2d');
    charts.pattern = new Chart(patternCtx, {
        type: 'doughnut',
        data: {
            labels: ['Crypto Scams', 'Pump & Dump', 'Contact Harvest', 'Fake Testimonials', 'Other'],
            datasets: [{
                data: [0, 0, 0, 0, 0],
                backgroundColor: [
                    'rgba(239, 68, 68, 0.8)',
                    'rgba(245, 158, 11, 0.8)',
                    'rgba(59, 130, 246, 0.8)',
                    'rgba(168, 85, 247, 0.8)',
                    'rgba(107, 114, 128, 0.8)'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                }
            }
        }
    });
}

// Load Dashboard Data
async function loadDashboardData() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();

        // Update stats
        document.getElementById('totalMessages').textContent = data.totalMessages || '0';
        document.getElementById('spamDetected').textContent = data.spamDetected || '0';
        document.getElementById('activeUsers').textContent = data.activeUsers || '0';
        document.getElementById('detectionRate').textContent =
            data.detectionRate ? `${data.detectionRate}%` : '0%';

        // Update charts
        if (data.weeklyActivity) {
            charts.spam.data.datasets[0].data = data.weeklyActivity.spam;
            charts.spam.data.datasets[1].data = data.weeklyActivity.total;
            charts.spam.update();
        }

        if (data.patternDistribution) {
            charts.pattern.data.datasets[0].data = Object.values(data.patternDistribution);
            charts.pattern.update();
        }

        // Update activity table
        if (data.recentActivity) {
            updateActivityTable(data.recentActivity);
        }

    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showNotification('Failed to load dashboard data', 'error');
    }
}

// Start Real-Time Updates
function startRealTimeUpdates() {
    if (!eventSource) {
        eventSource = new EventSource('/api/events');

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            handleRealTimeUpdate(data);
        };

        eventSource.onerror = () => {
            console.error('EventSource connection error');
            document.getElementById('status').innerHTML = `
                <span class="inline-block w-2 h-2 bg-red-500 rounded-full mr-1"></span>
                Disconnected
            `;
            document.getElementById('status').className =
                'ml-4 px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800';
        };
    }
}

// Handle Real-Time Updates
function handleRealTimeUpdate(data) {
    if (data.type === 'message') {
        // Increment total messages
        const totalElem = document.getElementById('totalMessages');
        totalElem.textContent = String(parseInt(totalElem.textContent) + 1);

        if (data.spam) {
            // Increment spam counter
            const spamElem = document.getElementById('spamDetected');
            spamElem.textContent = String(parseInt(spamElem.textContent) + 1);
        }

        // Add to activity table
        addActivityRow(data);
    }

    if (data.type === 'user') {
        const usersElem = document.getElementById('activeUsers');
        usersElem.textContent = data.count;
    }
}

// Update Activity Table
function updateActivityTable(activities) {
    const tbody = document.getElementById('activityTable');
    tbody.innerHTML = '';

    activities.forEach(activity => {
        addActivityRow(activity);
    });
}

// Add Activity Row
function addActivityRow(activity) {
    const tbody = document.getElementById('activityTable');
    const row = document.createElement('tr');
    row.className = 'fade-in';

    const scoreClass = activity.score >= 7 ? 'text-red-600' :
                       activity.score >= 5 ? 'text-orange-500' :
                       activity.score >= 3 ? 'text-yellow-500' : 'text-green-500';

    const actionBadge = activity.action === 'deleted' ?
        '<span class="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">Deleted</span>' :
        activity.action === 'restricted' ?
        '<span class="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded-full">Restricted</span>' :
        '<span class="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Allowed</span>';

    row.innerHTML = `
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            ${new Date(activity.timestamp).toLocaleTimeString()}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
            ${activity.username || 'Unknown'}
        </td>
        <td class="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
            ${activity.message || ''}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold ${scoreClass}">
            ${activity.score || 0}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm">
            ${actionBadge}
        </td>
    `;

    // Add to beginning of table
    tbody.insertBefore(row, tbody.firstChild);

    // Keep only last 20 rows
    while (tbody.children.length > 20) {
        tbody.removeChild(tbody.lastChild);
    }
}

// Test Pattern
async function testPattern() {
    const message = document.getElementById('testMessage').value;
    if (!message) return;

    try {
        const response = await fetch('/api/test-pattern', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });

        const result = await response.json();

        // Show result
        const resultElem = document.getElementById('testResult');
        const score = result.score || 0;

        if (score >= 7) {
            resultElem.innerHTML = `<span class="text-red-600">High Risk (Score: ${score})</span>`;
        } else if (score >= 5) {
            resultElem.innerHTML = `<span class="text-orange-500">Medium Risk (Score: ${score})</span>`;
        } else if (score >= 3) {
            resultElem.innerHTML = `<span class="text-yellow-500">Low Risk (Score: ${score})</span>`;
        } else {
            resultElem.innerHTML = `<span class="text-green-500">Safe (Score: ${score})</span>`;
        }

        // Show matches
        if (result.matches && result.matches.length > 0) {
            document.getElementById('patternMatches').classList.remove('hidden');
            const matchList = document.getElementById('matchList');
            matchList.innerHTML = result.matches.map(match =>
                `<li class="text-gray-600">• ${match.category} (Score: ${match.score})</li>`
            ).join('');
        } else {
            document.getElementById('patternMatches').classList.add('hidden');
        }

    } catch (error) {
        console.error('Error testing pattern:', error);
    }
}

// Refresh Data
function refreshData() {
    loadDashboardData();
    showNotification('Dashboard refreshed', 'success');
}

// Settings Modal
function openSettings() {
    document.getElementById('settingsModal').classList.remove('hidden');
}

function closeSettings() {
    document.getElementById('settingsModal').classList.add('hidden');
}

async function saveSettings() {
    const settings = {
        spamThreshold: document.getElementById('spamThreshold').value,
        maxMessages: document.getElementById('maxMessages').value,
        restrictionHours: document.getElementById('restrictionHours').value
    };

    try {
        const response = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });

        if (response.ok) {
            closeSettings();
            showNotification('Settings saved successfully', 'success');
        }
    } catch (error) {
        console.error('Error saving settings:', error);
        showNotification('Failed to save settings', 'error');
    }
}

// Helper Functions
function getLast7Days() {
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        days.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
    }
    return days;
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg fade-in ${
        type === 'success' ? 'bg-green-500 text-white' :
        type === 'error' ? 'bg-red-500 text-white' :
        'bg-blue-500 text-white'
    }`;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
        notification.remove();
    }, 3000);
}