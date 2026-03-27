# Simple-web-chat

A simple and efficient web-based instant chat application built with Node.js and WebSocket, supporting real-time messaging, conversation management, and message history.

### (This document was translated by Doubao AI, AI may make mistakes.)

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
- npm or equivalent package manager

### Installation

1. **Clone or download the project**

```bash
git clone https://github.com/LhyYBMQ520/Simple-web-chat.git
cd Simple-web-chat
```

2. **Install dependencies**

```bash
npm i
```

3. **Start the server**

```bash
npm start
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
- **ID expiration**: IDs expire after 24 hours; a new ID is generated automatically

## 📁 Project Structure

```
Simple-web-chat/
├── server.js                 # Backend entry
├── package.json             # Project config
├── README.md                # Documentation
├── LICENSE                  # License
├── chat.db                  # SQLite database (generated at runtime)
└── public/                  # Frontend static files
    ├── index.html          # Main HTML
    ├── css/
    │   └── style.css       # Styles
    ├── js/
    │   └── script.js       # Frontend logic
    └── fontawesome-free-7.2.0-web/  # Local icon library
```

## 🔧 Core Functionality

### Backend

- **WebSocket connection management**: Maintains active client connections
- **User binding**: Binds user ID to WebSocket connection
- **Message routing**: Forwards messages between users
- **Online list broadcast**: Pushes real-time online user list
- **Data persistence**: Stores all messages in SQLite

### Frontend

- **UI interaction**: Conversation list, chat window, input area
- **WebSocket communication**: Persistent connection to server
- **Local storage**: Saves sessions, nicknames, and IDs via localStorage
- **History loading**: Loads past messages from server
- **Status sync**: Updates online status and unread count in real time

## 📊 Database Design

### messages table

| Column   | Type    | Description          |
|----------|---------|----------------------|
| id       | INTEGER | Primary key (auto-increment) |
| sender   | TEXT    | Sender user ID       |
| receiver | TEXT    | Receiver user ID     |
| content  | TEXT    | Message content      |
| time     | INTEGER | Timestamp            |

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

// Get chat history
{type: "getHistory", with: "other_id"}

// Online user list
{type: "online", list: ["user1", "user2", ...]}
```

## 📅 Future Plans

- [ ] Add end-to-end encryption and privacy features ⭐
- [ ] Auto-clean expired messages and old IDs
- [ ] Support file and image transmission
- [ ] Group chat
- [ ] Message search and filter
- [ ] Message recall and edit
- [ ] Read/delivered status indicators
- [ ] "Typing..." status

## 🔒 Security

- This application is intended for demonstration and learning purposes
- For production use, add input validation, authentication, and rate limiting
- IDs expire after 24 hours for basic privacy

## 📝 License

MIT License – see [LICENSE](../LICENSE) for details.

## 🤝 Contributing

Issues and pull requests are welcome!
