/**
 * CHAT ROUTES
 * REST API endpoints for messages, search, and user listing.
 * The Trie and LRU Cache are passed in from the server.
 */

const express = require('express');
const router = express.Router();
const { Users, Messages } = require('../models/Storage');
const { analyzeMessage } = require('../utils/AIFilter');

// Middleware: ensure user is authenticated
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Please log in first' });
  }
  next();
}

module.exports = (trie, lruCache) => {

  // --- GET ALL USERS (contact list) ---
  router.get('/users', requireAuth, (req, res) => {
    const users = Users.getAllExcept(req.session.userId);
    res.json(users);
  });

  // --- GET CONVERSATION with a specific user ---
  router.get('/messages/:contactId', requireAuth, (req, res) => {
    const { contactId } = req.params;
    const myId = req.session.userId;

    // Check LRU cache first
    const cacheKey = [myId, contactId].sort().join('_');
    let messages = lruCache.get(cacheKey);

    if (!messages) {
      // Cache miss — load from storage
      messages = Messages.getConversation(myId, contactId);
      lruCache.put(cacheKey, messages); // Cache for next time
    }

    // Mark messages as read
    Messages.markRead(contactId, myId);

    res.json(messages);
  });

  // --- SEARCH MESSAGES using Trie ---
  router.get('/search', requireAuth, (req, res) => {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.json([]);
    }

    // Use Trie to find message IDs matching the prefix
    const matchingIds = trie.searchByPrefix(q.trim());

    if (matchingIds.length === 0) {
      return res.json([]);
    }

    // Fetch full message objects, filter to only current user's messages
    const myId = req.session.userId;
    const allMatches = Messages.findByIds(matchingIds);
    const filtered = allMatches.filter(m => m.senderId === myId || m.receiverId === myId);

    // Enrich with sender username
    const enriched = filtered.map(m => {
      const sender = Users.findById(m.senderId);
      return { ...m, senderName: sender ? sender.username : 'Unknown' };
    });

    res.json(enriched);
  });

  // --- ANALYZE a message (preview before sending) ---
  router.post('/analyze', requireAuth, (req, res) => {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'No content provided' });

    const analysis = analyzeMessage(content);
    res.json({
      smartReplies: analysis.smartReplies,
      warning: analysis.warning,
      blocked: analysis.blocked
    });
  });

  // --- GET RECENT CONTACTS (sorted by last message) ---
  router.get('/recent', requireAuth, (req, res) => {
    const myId = req.session.userId;
    const recent = Messages.getRecentContacts(myId);

    // Enrich with user info
    const enriched = recent.map(({ contactId, lastMessage }) => {
      const user = Users.findById(contactId);
      if (!user) return null;
      const unread = Messages.countUnread(contactId, myId);
      return {
        user: { id: user.id, username: user.username, avatar: user.avatar, isOnline: user.isOnline },
        lastMessage,
        unread
      };
    }).filter(Boolean);

    res.json(enriched);
  });

  return router;
};
