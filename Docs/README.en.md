# Simple-web-chat

A simple and efficient web-based instant chat application built with Node.js and WebSocket, supporting real-time messaging, conversation management, and message history.

### (This document was translated by AI, AI may make mistakes.)

# Language

[简体中文](../README.md) | [繁體中文](README.zh-TW.md) | [English](README.en.md)

## 📋 Introduction

Simple-web-chat is a lightweight, out-of-the-box web chat system. Users can quickly obtain a unique temporary ID without registration. By exchanging IDs, users can establish sessions and communicate in real time. All messages are persistently stored in a local database, with support for viewing chat history.

## ✨ Features

- **⚡ Real-time communication**: Bidirectional real-time message transmission based on WebSocket
- **🆔 Quick start**: Automatically generated unique user ID, valid for 24 hours
- **💾 Message storage**: All chat records persisted using SQLite
- **📋 Conversation management**: Manage multiple conversations and switch easily
- **👥 Online status**: Real-time online/offline status for contacts
- **📝 User nicknames**: Set nicknames for contacts for easy identification
- **🔔 Unread reminders**: Unread message notifications
- **✏️ Message edit & recall**: Edit your sent messages or recall them into a system notice state
- **✅ Per-message read status**: Show read/unread status next to the timestamp on each message, with real-time sync
- **📶 Connection status & latency**: Real-time server connection status and latency shown on the right side of the conversation-list header
- **📱 Responsive design**: Optimized for both desktop and mobile screens
- **⚙️ Zero configuration**: Ready to use without complex setup

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript, WebSocket
- **Backend**: Node.js, Express, WebSocket (ws)
- **Database**: SQLite3 (better-sqlite3)
- **Icons**: FontAwesome 7.2.0 (local)

## 📦 Dependencies

```json
{
  "dependencies": {
    "better-sqlite3": "^12.8.0",
    "express": "^5.2.1",
    "ws": "^8.20.0"
  }
}
```

## 🚀 Quick Start

### Requirements

- Node.js 14.0 or later (developed on v22)
- pnpm or equivalent package manager

### Installation

1. **Clone or download the project**

```bash
git clone https://github.com/LhyYBMQ520/Simple-web-chat.git
cd Simple-web-chat
```

2. **Install dependencies**

```bash
pnpm i
```

3. **Start the server**

```bash
pnpm start
```

The server runs on port `21451`.

4. **Open your browser**

Visit `http://IP:21451`

## 💬 Usage Guide

### Start Chatting Quickly

1. **Get your ID**
   - After entering the page, your unique ID is automatically generated in the sidebar
   - Click the copy button to copy your ID

2. **Add a chat partner**
   - Enter the other person’s ID in the input box
   - Click "Send Request"
   - Wait for approval

3. **Start chatting**
   - A conversation is created once the request is accepted
   - Type a message and press Enter or click Send
   - All messages are automatically saved to the database

4. **Manage conversations**
   - Click a conversation to switch chat partners
   - Right-click a conversation for management options
   - Set nicknames for contacts
   - Delete unwanted conversations

### Feature Details

- **Online status**: Green dot = online, red dot = offline
- **Unread count**: Small red badge appears for unread messages
- **Message history**: Automatically loaded when switching conversations
- **Message edit/recall**: Only your own sent messages can be edited or recalled; recalled messages are shown as system-style recall text
- **Message meta text**: Normal messages show `time · Read/Unread`; edited messages show `edited time · Edited · Read/Unread`
- **Recalled message display rule**: Recalled messages hide both timestamp and read/unread meta text
- **Connection status display**: The conversation-list header shows status icons such as connecting/reconnecting/disconnected/connected
- **Connection latency display**: Shows real-time latency (ms) while connected
- **ID expiration**: IDs expire after 24 hours; a new ID is generated automatically

## 📁 Project Structure

```
Simple-web-chat/
├── server.js                 # Backend entry (startup and module wiring)
├── package.json             # Project config
├── README.md                # Documentation
├── LICENSE                  # License
├── db/                      # Session databases (auto-generated)
├── src/                     # Backend modules
│   ├── config/
│   │   └── constants.js     # Backend constants
│   ├── services/
│   │   ├── session-db-service.js  # Session DB and message persistence service
│   │   └── uid-service.js   # UID lifecycle service
│   └── ws/
│       └── connection-handler.js   # WebSocket message handler
└── public/                  # Frontend static files
    ├── index.html          # Main HTML
    ├── css/
    │   └── style.css       # Styles
    ├── js/
   │   ├── app-state.js    # Frontend state module
   │   ├── uid-module.js   # UID and copy utility module
   │   ├── message-module.js  # Message rendering and state module
   │   ├── session-module.js  # Session and remark management module
   │   ├── ws-module.js    # WebSocket communication and latency-detection module
   │   └── script.js       # Frontend entry and module composition
    └── fontawesome-free-7.2.0-web/  # Local icon library
```

## 🔧 Core Functionality

### Backend

- **Modular architecture**: `server.js` handles startup/wiring only, while core logic is split into `src/config`, `src/services`, and `src/ws`
- **WebSocket connection management**: Maintains active client connections
- **User binding**: Binds user ID to WebSocket connection
- **Message routing**: Forwards messages between users
- **Online list broadcast**: Pushes real-time online user list
- **Data persistence**: Stores all messages in SQLite
- **Message edit/recall**: Provides `editMessage` and `recallMessage` handlers with ownership/session validation, then broadcasts updates to both sides
- **Read-state synchronization**: Uses `read_at` to persist read state; updates read status when user opens a conversation or is actively viewing it
- **Heartbeat response**: Handles frontend `ping` heartbeats and returns `pong` for client-side connection quality and latency measurement
- **UID lifecycle management**: Records UID creation time, auto-calculates 24-hour expiration, enforces validity checks on both frontend and backend
- **Session-based independent database storage**: Each session owns an independent database file stored in `/db` directory with filename format `uid1,uid2.db` (sorted to avoid duplicates)
- **Auto-cleanup strategy**: Periodically detects expired UIDs and automatically deletes corresponding database files with retry mechanism for safe deletion

### Frontend

- **Modular architecture**: `script.js` now acts as the entry/composition layer, while core logic is split into `app-state`, `uid`, `message`, `session`, and `ws` modules
- **UI interaction**: Conversation list, chat window, input area
- **WebSocket communication**: Persistent connection to server
- **Local storage**: Saves sessions, nicknames, and IDs via localStorage
- **History loading**: Loads past messages from server
- **Status sync**: Updates online status and unread count in real time
- **Connection status visualization**: Shows connection-state icons in the sidebar header (connecting/reconnecting/disconnected/connected)
- **Latency measurement**: Uses WebSocket heartbeats (`ping`/`pong`) to calculate and display current connection latency
- **Message actions**: Supports editing and recalling self-sent messages with real-time UI updates
- **Read receipt rendering**: Shows read/unread next to message time and updates immediately on `messagesRead` events
- **Edited-time rendering**: After editing, the message meta time is updated to the edited timestamp and marked as `Edited`
- **UID status display**: Real-time display of remaining UID validity period with warning indicators for expiring UIDs

## 📊 Database Design

### messages table

| Column   | Type    | Description          |
|----------|---------|----------------------|
| id       | INTEGER | Primary key (auto-increment) |
| sender   | TEXT    | Sender user ID       |
| receiver | TEXT    | Receiver user ID     |
| content  | TEXT    | Message content      |
| time     | INTEGER | Timestamp            |
| status   | TEXT    | Message status (`normal` / `recalled`) |
| edited_at| INTEGER | Edited timestamp (`NULL` if not edited) |
| read_at  | INTEGER | Read timestamp (`NULL` if unread) |

## 🌐 WebSocket Protocol

All messages use JSON format. Common types:

```javascript
// Bind user ID
{type: "bind", uid: "user_id"}

// Send chat request
{type: "request", to: "target_id"}

// Accept request
{type: "accept", from: "requester_id"}

// Send message
{type: "message", to: "target_id", content: "message_content"}

// Edit message
{type: "editMessage", to: "target_id", messageId: 1, content: "new_content"}

// Recall message
{type: "recallMessage", to: "target_id", messageId: 1}

// Report active conversation (for read-state detection)
{type: "activeChat", with: "other_id"}

// Heartbeat probe (sent by client)
{type: "ping", clientTime: 1710000000000}

// Heartbeat response (returned by server)
{type: "pong", clientTime: 1710000000000, serverTime: 1710000000100}

// Get chat history
{type: "getHistory", with: "other_id"}

// Chat history response (each item is a full message object)
{type: "history", list: [{id, sender, receiver, content, time, status, editedAt, readAt}]}

// Real-time message
{type: "msg", message: {id, sender, receiver, content, time, status, editedAt, readAt}}

// Message edited
{type: "messageEdited", message: {id, sender, receiver, content, time, status, editedAt, readAt}}

// Message recalled
{type: "messageRecalled", message: {id, sender, receiver, content, time, status, editedAt, readAt}}

// Batch read-receipt updates
{type: "messagesRead", messages: [{id, sender, receiver, content, time, status, editedAt, readAt}]}

// Online user list
{type: "online", list: ["user1", "user2", ...]}
```

## 📅 Future Plans

- [ ] Add end-to-end encryption and privacy features ( Am I going to die too .png )
- [ ] Support file and image transmission
- [ ] Group chat
- [ ] Message search and filter
- [ ] "Typing..." status

## 🔒 Security

- This application is intended for demonstration and learning purposes
- For production use, add input validation, authentication, and rate limiting
- IDs expire after 24 hours for basic privacy

## 📝 License

MIT License – see [LICENSE](../LICENSE) for details.

## 🤝 Contributing

Issues and pull requests are welcome!
