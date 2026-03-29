# ⚡ NeatChat++ 
### AI-Powered Real-Time Chat Platform with Optimized Data Structures

---

## 📁 Folder Structure

```
neatchat-plus-plus/
│
├── public/                  ← Frontend (HTML + CSS + JS)
│   ├── index.html           ← Main app page (single page app)
│   ├── css/
│   │   └── style.css        ← All styles (dark terminal aesthetic)
│   └── js/
│       └── app.js           ← Frontend logic, socket.io, search, UI
│
├── src/                     ← Backend (Node.js + Express)
│   ├── server.js            ← 🚀 Main server entry point
│   │
│   ├── routes/
│   │   ├── auth.js          ← Login, Signup, Logout endpoints
│   │   └── chat.js          ← Messages, Search, Contacts endpoints
│   │
│   ├── models/
│   │   └── Storage.js       ← JSON file database (Users + Messages)
│   │
│   └── utils/
│       ├── Trie.js          ← 🌲 Trie data structure (fast message search)
│       ├── LRUCache.js      ← 🧠 LRU Cache (recent conversations)
│       ├── MessageHeap.js   ← 📊 Min-Heap (message prioritization)
│       └── AIFilter.js      ← 🤖 Spam detection + smart replies
│
├── data/                    ← Auto-created on first run
│   ├── users.json           ← User accounts stored here
│   └── messages.json        ← Chat messages stored here
│
├── package.json
└── README.md
```

---

## 🧠 Data Structures Used

| Structure | File | Purpose |
|-----------|------|---------|
| **Trie** | `utils/Trie.js` | Index every word in every message. Enables instant prefix-based search — O(m) where m = query length |
| **LRU Cache** | `utils/LRUCache.js` | Cache the 20 most recently accessed conversations in memory. Avoids re-reading disk on every chat switch |
| **Min-Heap** | `utils/MessageHeap.js` | Priority queue for messages. Urgent messages (priority 1) bubble to top |

---

## 🤖 AI Features

| Feature | How it works |
|---------|-------------|
| **Spam Detection** | Regex patterns catch URLs, repeated chars, excessive caps, promo words |
| **Offensive Filter** | Keyword list check — flagged words get auto-censored with `***` |
| **Smart Replies** | Context analysis of incoming message → 3 pre-written reply suggestions |
| **Priority Scoring** | Messages with "urgent", "help", "@mention" get priority 1 (high) |

---

## 🚀 Setup Instructions

### Step 1 — Prerequisites
Make sure you have **Node.js** installed (version 16+).
```bash
node --version   # Should show v16+ 
npm --version    # Should show 7+
```

### Step 2 — Install Dependencies
```bash
cd neatchat-plus-plus
npm install
```

### Step 3 — Start the Server
```bash
npm start
```
Or in development mode (auto-restart on file changes):
```bash
npm run dev
```

### Step 4 — Open the App
Open your browser and go to:
```
http://localhost:3000
```

### Step 5 — Create Two Accounts to Test Chat
1. Open `http://localhost:3000` in **Browser Tab 1** → Sign up as `alice`
2. Open `http://localhost:3000` in **Browser Tab 2 (Incognito)** → Sign up as `bob`  
3. Click on `alice` from bob's contact list and start chatting!

---

## 🛠️ Available API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Register new user |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Get current session user |
| GET | `/api/chat/users` | Get all contacts |
| GET | `/api/chat/messages/:contactId` | Get conversation (uses LRU) |
| GET | `/api/chat/search?q=keyword` | Search messages (uses Trie) |
| GET | `/api/chat/recent` | Get recent conversations |
| POST | `/api/chat/analyze` | Analyze message for AI features |

## 🔌 Socket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `message:send` | Client → Server | Send a new message |
| `message:receive` | Server → Client | Receive a message |
| `message:sent` | Server → Sender | Confirm message was sent |
| `message:blocked` | Server → Sender | Message blocked by AI |
| `typing:start` | Client → Server | User started typing |
| `typing:stop` | Client → Server | User stopped typing |
| `typing:indicator` | Server → Client | Show/hide typing dots |
| `user:status` | Server → All | User went online/offline |

---

## 💡 How to Extend

- **Add MongoDB**: Replace `Storage.js` with Mongoose models
- **Add rooms/groups**: Add a `room` concept to the socket events
- **Better AI**: Replace `AIFilter.js` with an OpenAI API call
- **File sharing**: Add multer for file uploads
- **Authentication**: Add JWT tokens instead of session cookies

---

## 📦 Dependencies

```json
{
  "express": "Web framework",
  "socket.io": "Real-time WebSocket communication",
  "bcryptjs": "Password hashing",
  "uuid": "Unique ID generation",
  "express-session": "Session management",
  "cors": "Cross-origin requests"
}
```
