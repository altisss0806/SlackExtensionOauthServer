// ============================================
// Slack OAuth Token Exchange for GitHub Pages
// ============================================

// Configuration - UPDATE THESE VALUES
const CONFIG = {
    CLIENT_ID: '9129744248003.10087834431718',
    CLIENT_SECRET: '9ecc93f5bb1f8d7a7f247364970c03df',
    // App-Level Token for Socket Mode (xapp-...)
    APP_TOKEN: 'xapp-1-A0A2KQJCPM4-10078796510919-42d11dc27be57ce384d06e10e7fb9199a7e2ea19252c23c27eb66eb26567e515',
    // User scopes for OAuth - these are the permissions required
    USER_SCOPES: 'channels:read,channels:history,chat:write,groups:read,groups:history,im:read,im:history,users:read,files:read',
    // This should match your GitHub Pages URL
    // e.g., https://yourusername.github.io/slack-oauth/
    get REDIRECT_URI() {
        return window.location.origin + window.location.pathname;
    },
    VSCODE_URI_SCHEME: 'vscode://fos.vscode-slack-chat/callback',
    ANTIGRAVITY_URI_SCHEME: 'antigravity://fos.vscode-slack-chat/callback'
};

// Store token for copy function
let currentToken = null;

// Parse URL parameters
function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        code: params.get('code'),
        state: params.get('state'),
        error: params.get('error'),
        error_description: params.get('error_description')
    };
}

// Show specific state
function showState(stateId) {
    const states = ['loading-state', 'success-state', 'error-state', 'no-code-state', 'warning-state'];
    states.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('show');
    });
    const targetEl = document.getElementById(stateId);
    if (targetEl) targetEl.classList.add('show');
}

// Check if running on valid HTTPS
function isValidProtocol() {
    return window.location.protocol === 'https:' || window.location.hostname === 'localhost';
}

// Exchange authorization code for token
async function exchangeCodeForToken(code) {
    const params = new URLSearchParams({
        client_id: CONFIG.CLIENT_ID,
        client_secret: CONFIG.CLIENT_SECRET,
        code: code,
        redirect_uri: CONFIG.REDIRECT_URI
    });

    try {
        // Use Slack's oauth.v2.access endpoint
        const response = await fetch('https://slack.com/api/oauth.v2.access', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params.toString()
        });

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Token exchange error:', error);
        throw error;
    }
}

// Redirect to VSCode with token
function redirectToVSCode(token, teamName, state) {
    const vscodeUrl = `${CONFIG.VSCODE_URI_SCHEME}?token=${encodeURIComponent(token)}&team=${encodeURIComponent(teamName)}&state=${state || ''}&appToken=${encodeURIComponent(CONFIG.APP_TOKEN)}`;

    // Update countdown display
    let countdown = 3;
    const countdownEl = document.getElementById('countdown');
    if (countdownEl) {
        countdownEl.textContent = countdown;
        const interval = setInterval(() => {
            countdown--;
            countdownEl.textContent = countdown;
            if (countdown <= 0) {
                clearInterval(interval);
            }
        }, 1000);
    }

    // Auto redirect after 3 seconds
    setTimeout(() => {
        window.location.href = vscodeUrl;
    }, 3000);
}

// Display success with token
function displaySuccess(tokenData) {
    const token = tokenData.authed_user?.access_token || tokenData.access_token;
    const teamName = tokenData.team?.name || 'Unknown Team';
    const state = getUrlParams().state;

    currentToken = token;

    document.getElementById('team-display').textContent = `Team: ${teamName}`;
    document.getElementById('token-display').textContent = token;

    // Setup VSCode deep link
    const vscodeLink = document.getElementById('vscode-link');
    const vscodeUrl = `${CONFIG.VSCODE_URI_SCHEME}?token=${encodeURIComponent(token)}&team=${encodeURIComponent(teamName)}&state=${state || ''}&appToken=${encodeURIComponent(CONFIG.APP_TOKEN)}`;
    vscodeLink.href = vscodeUrl;

    // Setup Antigravity deep link
    const antigravityLink = document.getElementById('antigravity-link');
    const antigravityUrl = `${CONFIG.ANTIGRAVITY_URI_SCHEME}?token=${encodeURIComponent(token)}&team=${encodeURIComponent(teamName)}&state=${state || ''}&appToken=${encodeURIComponent(CONFIG.APP_TOKEN)}`;
    antigravityLink.href = antigravityUrl;

    showState('success-state');

    // Auto-redirect to VSCode (can be changed to Antigravity if preferred)
    redirectToVSCode(token, teamName, state);
}

// Display error
function displayError(error, description) {
    document.getElementById('error-details').textContent =
        description || error || 'An unknown error occurred';
    showState('error-state');
}

// Copy token to clipboard
function copyToken() {
    if (!currentToken) return;

    navigator.clipboard.writeText(currentToken).then(() => {
        const btn = document.getElementById('copy-btn');
        const icon = document.getElementById('copy-icon');
        const text = document.getElementById('copy-text');

        btn.classList.add('copied');
        icon.textContent = '✅';
        text.textContent = 'Copied!';

        setTimeout(() => {
            btn.classList.remove('copied');
            icon.textContent = '📋';
            text.textContent = 'Copy Token';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
        alert('Failed to copy token. Please select and copy manually.');
    });
}

// Sign in with Slack - redirect to authorization URL
function signInWithSlack() {
    // Check protocol first
    if (!isValidProtocol()) {
        showState('warning-state');
        return;
    }

    // Generate a random state for CSRF protection
    const state = Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);

    // Store state in sessionStorage for later verification (optional)
    sessionStorage.setItem('oauth_state', state);

    // Build the authorization URL
    const authUrl = `https://slack.com/oauth/v2/authorize?` +
        `client_id=${CONFIG.CLIENT_ID}` +
        `&user_scope=${encodeURIComponent(CONFIG.USER_SCOPES)}` +
        `&redirect_uri=${encodeURIComponent(CONFIG.REDIRECT_URI)}` +
        `&state=${state}`;

    // Redirect to Slack
    window.location.href = authUrl;
}

// Main initialization
async function init() {
    const params = getUrlParams();

    // Check for error from Slack
    if (params.error) {
        displayError(params.error, params.error_description);
        return;
    }

    // Check if we have an authorization code
    if (!params.code) {
        // Show warning if not HTTPS
        if (!isValidProtocol()) {
            showState('warning-state');
        } else {
            showState('no-code-state');
        }
        return;
    }

    // Show loading state
    showState('loading-state');

    try {
        // Exchange code for token
        const tokenData = await exchangeCodeForToken(params.code);

        if (tokenData.ok) {
            displaySuccess(tokenData);
        } else {
            displayError(tokenData.error, tokenData.error_description);
        }
    } catch (error) {
        displayError('exchange_failed', error.message);
    }
}

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', init);

// Expose functions globally for onclick
window.copyToken = copyToken;
window.signInWithSlack = signInWithSlack;

