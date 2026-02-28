import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import Database from "better-sqlite3";
import path from "path";

const db = new Database("wicara.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE,
    phone TEXT UNIQUE,
    ipAddress TEXT,
    avatar TEXT,
    status TEXT,
    lastSeen DATETIME,
    latitude REAL,
    longitude REAL,
    theme TEXT DEFAULT 'light',
    language TEXT DEFAULT 'ms'
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    senderId TEXT,
    receiverId TEXT,
    groupId TEXT,
    content TEXT,
    type TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    isRead INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    name TEXT,
    avatar TEXT
  );

  CREATE TABLE IF NOT EXISTS group_members (
    groupId TEXT,
    userId TEXT,
    PRIMARY KEY (groupId, userId)
  );

  CREATE TABLE IF NOT EXISTS stories (
    id TEXT PRIMARY KEY,
    userId TEXT,
    content TEXT,
    type TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    expiresAt DATETIME
  );
`);

// Migration: Add missing columns if they don't exist
try {
  const columns = db.prepare("PRAGMA table_info(users)").all() as any[];
  const hasPhone = columns.some(c => c.name === 'phone');
  const hasIp = columns.some(c => c.name === 'ipAddress');
  
  if (!hasPhone) {
    db.exec("ALTER TABLE users ADD COLUMN phone TEXT UNIQUE");
  }
  if (!hasIp) {
    db.exec("ALTER TABLE users ADD COLUMN ipAddress TEXT");
  }
} catch (e) {
  console.error("Migration error:", e);
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.post("/api/auth/login", (req, res) => {
    try {
      const { identifier, type, name } = req.body;
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      
      let user;
      if (type === 'email') {
        user = db.prepare("SELECT * FROM users WHERE email = ?").get(identifier);
      } else if (type === 'phone') {
        user = db.prepare("SELECT * FROM users WHERE phone = ?").get(identifier);
      } else if (type === 'ip') {
        user = db.prepare("SELECT * FROM users WHERE ipAddress = ?").get(ip);
      }

      if (!user) {
        // Register new user
        const id = "user_" + Math.random().toString(36).substring(7);
        const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${name || identifier}`;
        
        const stmt = db.prepare(`
          INSERT INTO users (id, name, email, phone, ipAddress, avatar) 
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run(
          id, 
          name || (identifier ? identifier.split('@')[0] : 'User'), 
          type === 'email' ? identifier : null,
          type === 'phone' ? identifier : null,
          type === 'ip' ? ip : null,
          avatar
        );
        user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
      } else {
        // Update IP on login
        db.prepare("UPDATE users SET ipAddress = ? WHERE id = ?").run(ip, user.id);
      }

      res.json(user);
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/users", (req, res) => {
    const users = db.prepare("SELECT * FROM users").all();
    res.json(users);
  });

  app.post("/api/users", (req, res) => {
    const { id, name, email, avatar } = req.body;
    const stmt = db.prepare("INSERT OR REPLACE INTO users (id, name, email, avatar) VALUES (?, ?, ?, ?)");
    stmt.run(id, name, email, avatar);
    res.json({ success: true });
  });

  app.get("/api/messages/:userId/:otherId", (req, res) => {
    const { userId, otherId } = req.params;
    const messages = db.prepare(`
      SELECT * FROM messages 
      WHERE (senderId = ? AND receiverId = ?) 
      OR (senderId = ? AND receiverId = ?)
      ORDER BY timestamp ASC
    `).all(userId, otherId, otherId, userId);
    res.json(messages);
  });

  app.get("/api/nearby", (req, res) => {
    const { lat, lng, radius = 50 } = req.query; // radius in km
    // Simple bounding box for nearby search
    const users = db.prepare("SELECT * FROM users WHERE latitude IS NOT NULL").all();
    res.json(users);
  });

  // WebSocket Logic
  const clients = new Map<string, WebSocket>();

  wss.on("connection", (ws, req) => {
    let userId: string | null = null;

    ws.on("message", (data) => {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case "auth":
          userId = message.userId;
          if (userId) clients.set(userId, ws);
          // Update last seen
          db.prepare("UPDATE users SET lastSeen = CURRENT_TIMESTAMP WHERE id = ?").run(userId);
          break;

        case "chat":
          const { senderId, receiverId, content, msgType, groupId } = message;
          const msgId = Math.random().toString(36).substring(7);
          db.prepare("INSERT INTO messages (id, senderId, receiverId, groupId, content, type) VALUES (?, ?, ?, ?, ?, ?)")
            .run(msgId, senderId, receiverId, groupId, content, msgType);
          
          const payload = JSON.stringify({ type: "chat", id: msgId, senderId, receiverId, groupId, content, msgType, timestamp: new Date() });
          
          if (receiverId && clients.has(receiverId)) {
            clients.get(receiverId)?.send(payload);
          }
          // Also send back to sender for confirmation if needed, or just broadcast to group
          if (groupId) {
            const members = db.prepare("SELECT userId FROM group_members WHERE groupId = ?").all(groupId);
            members.forEach((m: any) => {
              if (m.userId !== senderId && clients.has(m.userId)) {
                clients.get(m.userId)?.send(payload);
              }
            });
          }
          break;

        case "typing":
          if (message.receiverId && clients.has(message.receiverId)) {
            clients.get(message.receiverId)?.send(JSON.stringify({ type: "typing", senderId: message.senderId, isTyping: message.isTyping }));
          }
          break;

        case "call-request":
          if (message.receiverId && clients.has(message.receiverId)) {
            clients.get(message.receiverId)?.send(JSON.stringify(message));
          }
          break;
        
        case "call-response":
          if (message.callerId && clients.has(message.callerId)) {
            clients.get(message.callerId)?.send(JSON.stringify(message));
          }
          break;
      }
    });

    ws.on("close", () => {
      if (userId) {
        clients.delete(userId);
        db.prepare("UPDATE users SET lastSeen = CURRENT_TIMESTAMP WHERE id = ?").run(userId);
      }
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const PORT = 3000;
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
