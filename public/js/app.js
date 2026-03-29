/**
 * NEATCHAT++ FRONTEND
 * Handles:
 *   - Auth (login/signup)
 *   - Socket.io real-time messaging
 *   - Contact list and chat UI
 *   - Message search via Trie (API call)
 *   - Smart replies display
 *   - Typing indicators
 *   - Toast notifications
 */

// ============================================================
// APP STATE
// ============================================================
const state = {
  currentUser: null,        // Logged-in user object
  activeContact: null,      // Currently selected contact
  socket: null,             // Socket.io instance
  typingTimer: null,        // For debouncing typing events
  searchTimer: null,        // For debouncing search input
  contacts: [],             // All available contacts
};

// ============================================================
// UTILITIES
// ============================================================

/** Show a toast notification */
function showToast(msg, type = 'info', duration = 3000) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), duration);
}

/** Format a timestamp for display */
function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Make a fetch request with JSON body */
async function apiFetch(url, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include'
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  return res.json();
}

/** Auto-grow the textarea as the user types */
function autoGrow(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

/** Scroll messages container to the bottom */
function scrollToBottom() {
  const container = document.getElementById('messages-container');
  container.scrollTop = container.scrollHeight;
}

// ============================================================
// AUTH
// ============================================================

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`${tab}-form`).classList.add('active');
  });
});

// Login
document.getElementById('login-btn').addEventListener('click', async () => {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');

  errEl.textContent = '';
  if (!username || !password) { errEl.textContent = 'Please fill in all fields'; return; }

  const result = await apiFetch('/api/auth/login', 'POST', { username, password });

  if (result.error) {
    errEl.textContent = result.error;
  } else {
    initChatScreen(result.user);
  }
});

// Signup
document.getElementById('signup-btn').addEventListener('click', async () => {
  const username = document.getElementById('signup-username').value.trim();
  const password = document.getElementById('signup-password').value;
  const errEl = document.getElementById('signup-error');

  errEl.textContent = '';
  if (!username || !password) { errEl.textContent = 'Please fill in all fields'; return; }

  const result = await apiFetch('/api/auth/signup', 'POST', { username, password });

  if (result.error) {
    errEl.textContent = result.error;
  } else {
    showToast(`Welcome to NeatChat++, ${result.user.username}! 🎉`, 'success');
    initChatScreen(result.user);
  }
});

// Enter key support for auth inputs
['login-username', 'login-password', 'signup-username', 'signup-password'].forEach(id => {
  document.getElementById(id).addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const isLogin = id.startsWith('login');
      document.getElementById(isLogin ? 'login-btn' : 'signup-btn').click();
    }
  });
});

// Logout
document.getElementById('logout-btn').addEventListener('click', async () => {
  if (state.socket) state.socket.disconnect();
  await apiFetch('/api/auth/logout', 'POST');
  state.currentUser = null;
  state.activeContact = null;
  document.getElementById('auth-screen').classList.add('active');
  document.getElementById('chat-screen').classList.remove('active');
});

// ============================================================
// CHAT SCREEN INIT
// ============================================================

async function initChatScreen(user) {
  state.currentUser = user;

  // Switch screens
  document.getElementById('auth-screen').classList.remove('active');
  document.getElementById('chat-screen').classList.add('active');

  // Set user info in sidebar
  document.getElementById('my-avatar').src = user.avatar;
  document.getElementById('my-username').textContent = user.username;

  // Connect socket
  connectSocket();

  // Load contacts
  await loadContacts();
}

// Check if already logged in on page load
async function checkSession() {
  const result = await apiFetch('/api/auth/me');
  if (result.id) {
    initChatScreen(result);
  }
}

// ============================================================
// SOCKET.IO
// ============================================================

function connectSocket() {
  state.socket = io({ withCredentials: true });

  state.socket.on('connect', () => {
    console.log('✅ Socket connected');
  });

  // Receive a new message
  state.socket.on('message:receive', (message) => {
    // If this message is from the active contact, append it to the chat
    if (state.activeContact && message.senderId === state.activeContact.id) {
      appendMessage(message, 'received');
      scrollToBottom();
      showSmartReplies(message.smartReplies || []);
    } else {
      // Notify about message from another contact
      const sender = state.contacts.find(c => c.id === message.senderId);
      const name = sender ? sender.username : 'Someone';
      showToast(`💬 New message from ${name}`, 'info');
      // Update contact list to show unread badge
      loadContacts();
    }
  });

  // Confirm our own sent message
  state.socket.on('message:sent', (message) => {
    // Update the pending message with confirmed data
    const pendingEl = document.querySelector('.message.pending');
    if (pendingEl) pendingEl.classList.remove('pending');

    if (message.warning) {
      showToast(`⚠️ ${message.warning}`, 'warning', 4000);
    }
  });

  // Message blocked by AI filter
  state.socket.on('message:blocked', ({ reason }) => {
    showToast(`🚫 Message blocked: ${reason}`, 'error', 4000);
    // Remove pending bubble
    const pendingEl = document.querySelector('.message.pending');
    if (pendingEl) pendingEl.remove();
  });

  // Typing indicator
  state.socket.on('typing:indicator', ({ userId, username, isTyping }) => {
    if (state.activeContact && userId === state.activeContact.id) {
      const indicator = document.getElementById('typing-indicator');
      document.getElementById('typing-name').textContent = username;
      indicator.classList.toggle('hidden', !isTyping);
    }
  });

  // User online/offline status
  state.socket.on('user:status', ({ userId, isOnline }) => {
    // Update contact in list
    const contactEl = document.querySelector(`.contact-item[data-id="${userId}"]`);
    if (contactEl) {
      const avatar = contactEl.querySelector('.avatar');
      if (avatar) avatar.classList.toggle('online', isOnline);
    }

    // Update chat header if this is the active contact
    if (state.activeContact && userId === state.activeContact.id) {
      const statusEl = document.getElementById('chat-status');
      statusEl.textContent = isOnline ? 'Online' : 'Offline';
      statusEl.className = 'chat-status' + (isOnline ? ' online' : '');
      state.activeContact.isOnline = isOnline;
    }

    // Update our contacts array
    const contact = state.contacts.find(c => c.id === userId);
    if (contact) contact.isOnline = isOnline;
  });
}

// ============================================================
// CONTACTS
// ============================================================

async function loadContacts() {
  const users = await apiFetch('/api/chat/users');
  state.contacts = users;
  renderContactList(users);
}

function renderContactList(users) {
  const list = document.getElementById('contact-list');

  if (!users.length) {
    list.innerHTML = '<div class="loading-text">No other users yet. Ask a friend to sign up!</div>';
    return;
  }

  list.innerHTML = users.map(user => `
    <div class="contact-item" data-id="${user.id}" onclick="openChat('${user.id}')">
      <img class="avatar ${user.isOnline ? 'online' : ''}" 
           src="${user.avatar}" 
           alt="${user.username}" 
           onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}'"/>
      <div style="flex:1; min-width:0">
        <div class="contact-name">${escapeHtml(user.username)}</div>
        <div class="contact-last-msg">${user.isOnline ? '● Online' : 'Tap to chat'}</div>
      </div>
    </div>
  `).join('');

  // If there's an active contact, re-highlight it
  if (state.activeContact) {
    const el = document.querySelector(`.contact-item[data-id="${state.activeContact.id}"]`);
    if (el) el.classList.add('active');
  }
}

// ============================================================
// OPEN CHAT
// ============================================================

async function openChat(contactId) {
  const contact = state.contacts.find(c => c.id === contactId);
  if (!contact) return;

  state.activeContact = contact;

  // Highlight in sidebar
  document.querySelectorAll('.contact-item').forEach(el => el.classList.remove('active'));
  const contactEl = document.querySelector(`.contact-item[data-id="${contactId}"]`);
  if (contactEl) contactEl.classList.add('active');

  // Show chat panel
  document.getElementById('no-chat').classList.add('hidden');
  document.getElementById('active-chat').classList.remove('hidden');

  // Set header
  document.getElementById('chat-avatar').src = contact.avatar;
  document.getElementById('chat-username').textContent = contact.username;
  const statusEl = document.getElementById('chat-status');
  statusEl.textContent = contact.isOnline ? 'Online' : 'Offline';
  statusEl.className = 'chat-status' + (contact.isOnline ? ' online' : '');

  // Clear messages & smart replies
  document.getElementById('messages-container').innerHTML = '';
  document.getElementById('smart-replies').classList.add('hidden');

  // Load messages (will use LRU cache on server)
  const messages = await apiFetch(`/api/chat/messages/${contactId}`);
  messages.forEach(msg => {
    const type = msg.senderId === state.currentUser.id ? 'sent' : 'received';
    appendMessage(msg, type);
  });

  scrollToBottom();
  document.getElementById('message-input').focus();
}

// ============================================================
// MESSAGES
// ============================================================

function appendMessage(message, type) {
  const container = document.getElementById('messages-container');

  const div = document.createElement('div');
  div.className = `message ${type}`;
  div.dataset.id = message.id;

  // Priority badge
  let priorityBadge = '';
  if (message.priority === 1) priorityBadge = '<span class="priority-badge priority-1">● HIGH</span>';
  else if (message.priority === 2) priorityBadge = '<span class="priority-badge priority-2">● MED</span>';

  // Warning
  const warningHtml = message.warning
    ? `<div class="msg-warning">⚠️ ${escapeHtml(message.warning)}</div>`
    : '';

  div.innerHTML = `
    <div class="message-bubble">${escapeHtml(message.content)}</div>
    ${warningHtml}
    <div class="message-meta">
      <span>${formatTime(message.timestamp)}</span>
      ${priorityBadge}
    </div>
  `;

  container.appendChild(div);
}

// Send message
document.getElementById('send-btn').addEventListener('click', sendMessage);
document.getElementById('message-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

function sendMessage() {
  const input = document.getElementById('message-input');
  const content = input.value.trim();

  if (!content || !state.activeContact || !state.socket) return;

  // Optimistic UI: show message immediately as "pending"
  const tempMessage = {
    id: 'temp-' + Date.now(),
    senderId: state.currentUser.id,
    receiverId: state.activeContact.id,
    content,
    timestamp: new Date().toISOString(),
    priority: 3
  };
  appendMessage(tempMessage, 'sent pending');
  scrollToBottom();

  // Clear input
  input.value = '';
  input.style.height = 'auto';

  // Hide smart replies
  document.getElementById('smart-replies').classList.add('hidden');

  // Clear AI warning
  document.getElementById('ai-warning').classList.add('hidden');

  // Emit via socket
  state.socket.emit('message:send', {
    receiverId: state.activeContact.id,
    content
  });

  // Stop typing indicator
  state.socket.emit('typing:stop', { receiverId: state.activeContact.id });
}

// ============================================================
// TYPING INDICATOR
// ============================================================

document.getElementById('message-input').addEventListener('input', (e) => {
  autoGrow(e.target);

  if (!state.activeContact || !state.socket) return;

  // Emit typing:start
  state.socket.emit('typing:start', { receiverId: state.activeContact.id });

  // Stop after 2s of no typing
  clearTimeout(state.typingTimer);
  state.typingTimer = setTimeout(() => {
    state.socket.emit('typing:stop', { receiverId: state.activeContact.id });
  }, 2000);
});

// ============================================================
// SMART REPLIES
// ============================================================

function showSmartReplies(replies) {
  if (!replies || replies.length === 0) return;
  const container = document.getElementById('smart-replies');
  const btnsContainer = document.getElementById('smart-reply-btns');

  btnsContainer.innerHTML = replies.map(reply => `
    <button class="sr-btn" onclick="useSmartReply(this)">${escapeHtml(reply)}</button>
  `).join('');

  container.classList.remove('hidden');
}

function useSmartReply(btn) {
  const input = document.getElementById('message-input');
  input.value = btn.textContent;
  input.focus();
  document.getElementById('smart-replies').classList.add('hidden');
}

// ============================================================
// SEARCH (using Trie via API)
// ============================================================

document.getElementById('search-input').addEventListener('input', (e) => {
  const query = e.target.value.trim();
  clearTimeout(state.searchTimer);

  if (!query || query.length < 2) {
    document.getElementById('search-results').classList.add('hidden');
    return;
  }

  // Debounce: wait 300ms after user stops typing
  state.searchTimer = setTimeout(() => searchMessages(query), 300);
});

async function searchMessages(query) {
  const resultsEl = document.getElementById('search-results');
  resultsEl.classList.remove('hidden');
  resultsEl.innerHTML = '<div class="search-empty">Searching Trie...</div>';

  const results = await apiFetch(`/api/chat/search?q=${encodeURIComponent(query)}`);

  if (!results.length) {
    resultsEl.innerHTML = '<div class="search-empty">No messages found</div>';
    return;
  }

  resultsEl.innerHTML = results.slice(0, 8).map(msg => {
    const isMe = msg.senderId === state.currentUser.id;
    const displayContent = msg.content.length > 60 ? msg.content.slice(0, 60) + '...' : msg.content;
    return `
      <div class="search-result-item" onclick="searchResultClick('${msg.senderId}', '${msg.receiverId}')">
        <div class="search-result-sender">${isMe ? 'You' : escapeHtml(msg.senderName || 'Unknown')}</div>
        <div class="search-result-content">${escapeHtml(displayContent)}</div>
        <div class="search-result-time">${formatTime(msg.timestamp)}</div>
      </div>
    `;
  }).join('');
}

function searchResultClick(senderId, receiverId) {
  // Open chat with the relevant contact
  const contactId = senderId === state.currentUser.id ? receiverId : senderId;
  openChat(contactId);
  document.getElementById('search-results').classList.add('hidden');
  document.getElementById('search-input').value = '';
}

// Hide search results when clicking elsewhere
document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-bar') && !e.target.closest('.search-results')) {
    document.getElementById('search-results').classList.add('hidden');
  }
});

// ============================================================
// SECURITY: Escape HTML to prevent XSS
// ============================================================
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================
// INIT: Check session on page load
// ============================================================
checkSession();
