/**
 * JSON FILE STORAGE
 * Simple file-based database using JSON files.
 * Acts as a database abstraction layer — can be swapped for MongoDB later.
 *
 * Files stored:
 *   data/users.json    -> All registered users
 *   data/messages.json -> All chat messages
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');

// Ensure data directory and files exist on startup
function init() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify([]));
  if (!fs.existsSync(MESSAGES_FILE)) fs.writeFileSync(MESSAGES_FILE, JSON.stringify([]));
}

// ---- Generic read/write helpers ----

function readJSON(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ---- USER OPERATIONS ----

const Users = {
  getAll() {
    return readJSON(USERS_FILE);
  },

  findById(id) {
    return this.getAll().find(u => u.id === id) || null;
  },

  findByUsername(username) {
    return this.getAll().find(u => u.username.toLowerCase() === username.toLowerCase()) || null;
  },

  create(user) {
    const users = this.getAll();
    users.push(user);
    writeJSON(USERS_FILE, users);
    return user;
  },

  updateOnlineStatus(userId, isOnline) {
    const users = this.getAll();
    const idx = users.findIndex(u => u.id === userId);
    if (idx !== -1) {
      users[idx].isOnline = isOnline;
      users[idx].lastSeen = new Date().toISOString();
      writeJSON(USERS_FILE, users);
    }
  },

  // Return all users except the given userId (for contact list)
  getAllExcept(userId) {
    return this.getAll()
      .filter(u => u.id !== userId)
      .map(u => ({ id: u.id, username: u.username, avatar: u.avatar, isOnline: u.isOnline, lastSeen: u.lastSeen }));
  }
};

// ---- MESSAGE OPERATIONS ----

const Messages = {
  getAll() {
    return readJSON(MESSAGES_FILE);
  },

  /** Get conversation between two users */
  getConversation(userId1, userId2) {
    return this.getAll().filter(m =>
      (m.senderId === userId1 && m.receiverId === userId2) ||
      (m.senderId === userId2 && m.receiverId === userId1)
    ).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  },

  /** Save a new message */
  create(message) {
    const messages = this.getAll();
    messages.push(message);
    writeJSON(MESSAGES_FILE, messages);
    return message;
  },

  /** Find a message by ID */
  findById(id) {
    return this.getAll().find(m => m.id === id) || null;
  },

  /** Find messages by IDs (used after Trie search) */
  findByIds(ids) {
    return this.getAll().filter(m => ids.includes(m.id));
  },

  /** Get recent conversations for a user (list of unique contacts with last message) */
  getRecentContacts(userId) {
    const messages = this.getAll().filter(m => m.senderId === userId || m.receiverId === userId);
    const contactMap = new Map();

    for (const msg of messages) {
      const contactId = msg.senderId === userId ? msg.receiverId : msg.senderId;
      if (!contactMap.has(contactId) || new Date(msg.timestamp) > new Date(contactMap.get(contactId).timestamp)) {
        contactMap.set(contactId, msg);
      }
    }

    // Sort by most recent
    return [...contactMap.entries()]
      .sort((a, b) => new Date(b[1].timestamp) - new Date(a[1].timestamp))
      .map(([contactId, lastMsg]) => ({ contactId, lastMessage: lastMsg }));
  },

  /** Count unread messages from a sender to a receiver */
  countUnread(senderId, receiverId) {
    return this.getAll().filter(m =>
      m.senderId === senderId && m.receiverId === receiverId && !m.read
    ).length;
  },

  /** Mark messages as read */
  markRead(senderId, receiverId) {
    const messages = this.getAll();
    let updated = false;
    for (const msg of messages) {
      if (msg.senderId === senderId && msg.receiverId === receiverId && !msg.read) {
        msg.read = true;
        updated = true;
      }
    }
    if (updated) writeJSON(MESSAGES_FILE, messages);
  }
};

module.exports = { init, Users, Messages };
