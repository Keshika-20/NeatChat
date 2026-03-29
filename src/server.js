/**
 * NEATCHAT++ SERVER
 * Main entry point: sets up Express, Socket.io, routes, and real-time events.
 *
 * Architecture:
 *   - Express handles REST API (login, signup, message history, search)
 *   - Socket.io handles real-time messaging
 *   - Trie indexes all messages for fast search
 *   - LRU Cache stores recent conversations in memory
 *   - MessageHeap prioritizes incoming messages
 *   - AIFilter checks messages for spam/offensive content
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Internal modules
const { init, Users, Messages } = require('./models/Storage');
const Trie = require('./utils/Trie');
const LRUCache = require('./utils/LRUCache');
const MessageHeap = require('./utils/MessageHeap');
const { analyzeMessage } = require('./utils/AIFilter');
const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');

// ---- Initialize storage ----
init();

// ---- Initialize data structures ----
const messageTrie = new Trie();       // For message search
const recentChatsCache = new LRUCache(20); // Cache last 20 conversations
const messageHeap = new MessageHeap();   // For priority messages

// Pre-index existing messages into Trie on startup
const existingMessages = Messages.getAll();
existingMessages.forEach(msg => messageTrie.indexMessage(msg));
console.log(`✅ Trie indexed ${existingMessages.length} existing messages`);

// ---- Express Setup ----
const app = express();
const server = http.createServer(app);

// Session configuration (shared between Express and Socket.io)
const sessionMiddleware = session({
  secret: 'neatchat-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(sessionMiddleware);

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../public')));

// ---- API Routes ----
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes(messageTrie, recentChatsCache));

// Serve index.html for all non-API routes (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ---- Socket.io Setup ----
const io = new Server(server, {
  cors: { origin: '*', credentials: true }
});

// Share session with Socket.io
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

// Map of userId -> socketId for direct messaging
const onlineUsers = new Map();

io.on('connection', (socket) => {
  const session = socket.request.session;
  const userId = session?.userId;
  const username = session?.username;

  if (!userId) {
    socket.disconnect();
    return;
  }

  // Register user as online
  onlineUsers.set(userId, socket.id);
  Users.updateOnlineStatus(userId, true);
  console.log(`🟢 ${username} connected (socket: ${socket.id})`);

  // Notify all users that this person is online
  io.emit('user:status', { userId, username, isOnline: true });

  // ---- SEND MESSAGE ----
  socket.on('message:send', (data) => {
    const { receiverId, content } = data;

    if (!content || !content.trim()) return;
    if (!receiverId) return;

    // Run AI analysis on the message
    const analysis = analyzeMessage(content);

    if (analysis.blocked) {
      // Spam detected — only notify sender
      socket.emit('message:blocked', {
        reason: analysis.warning
      });
      return;
    }

    // Create message object
    const message = {
      id: uuidv4(),
      senderId: userId,
      receiverId,
      content: analysis.processed, // Censored if offensive
      originalContent: analysis.isOffensive ? content : null,
      timestamp: new Date().toISOString(),
      read: false,
      priority: analysis.priority,
      isOffensive: analysis.isOffensive,
      warning: analysis.warning || null
    };

    // Save to storage
    Messages.create(message);

    // Index in Trie for searchability
    messageTrie.indexMessage(message);

    // Insert into heap for priority tracking
    messageHeap.insert(message, analysis.priority);

    // Invalidate LRU cache for this conversation
    const cacheKey = [userId, receiverId].sort().join('_');
    recentChatsCache.put(cacheKey, null); // Invalidate

    // Emit to receiver if online
    const receiverSocketId = onlineUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('message:receive', {
        ...message,
        smartReplies: analysis.smartReplies
      });
    }

    // Confirm to sender
    socket.emit('message:sent', {
      ...message,
      warning: analysis.warning
    });
  });

  // ---- TYPING INDICATOR ----
  socket.on('typing:start', ({ receiverId }) => {
    const receiverSocketId = onlineUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('typing:indicator', { userId, username, isTyping: true });
    }
  });

  socket.on('typing:stop', ({ receiverId }) => {
    const receiverSocketId = onlineUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('typing:indicator', { userId, username, isTyping: false });
    }
  });

  // ---- GET SMART REPLIES ----
  socket.on('message:getSmartReplies', ({ messageId }) => {
    const msg = Messages.findById(messageId);
    if (msg) {
      const analysis = analyzeMessage(msg.content);
      socket.emit('message:smartReplies', { messageId, replies: analysis.smartReplies });
    }
  });

  // ---- DISCONNECT ----
  socket.on('disconnect', () => {
    onlineUsers.delete(userId);
    Users.updateOnlineStatus(userId, false);
    console.log(`🔴 ${username} disconnected`);
    io.emit('user:status', { userId, username, isOnline: false });
  });
});

// ---- Start Server ----
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🚀 NeatChat++ running at http://localhost:${PORT}`);
  console.log(`📦 Data structures: Trie ✅  LRU Cache ✅  MessageHeap ✅`);
  console.log(`🤖 AI Filter: Spam Detection ✅  Offensive Filter ✅  Smart Replies ✅\n`);
});
