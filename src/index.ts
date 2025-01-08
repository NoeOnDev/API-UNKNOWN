import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { envConfig } from "./_config/env.config";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

interface UserState {
  username: string;
  isOnline: boolean;
  lastSeen?: Date;
}

interface Message {
  id: string;
  sender: string;
  message: string;
  timestamp: Date;
  status: "sent" | "delivered" | "read";
}

interface MessageAudit {
  messageId: string;
  sender: string;
  recipient: string;
  timestamp: Date;
  eventType: "sent" | "delivered" | "read";
}

const users = new Map<string, UserState>();
const socketToUser = new Map<string, string>();

const privateMessages = new Map();
const messageAudit = new Map<string, MessageAudit[]>();

io.on("connection", (socket) => {
  console.log("🔌 Client connected:", socket.id);

  socket.on("join", (username) => {
    const existingUser = Array.from(users.values()).find(
      (u) => u.username === username
    );
    if (existingUser) {
      users.set(username, { ...existingUser, isOnline: true });
    } else {
      users.set(username, { username, isOnline: true });
    }

    socketToUser.set(socket.id, username);

    io.emit("users_status", Array.from(users.values()));
    console.log(`👤 ${username} has joined the chat`);
  });

  socket.on("get_history", (otherUser) => {
    const user = socketToUser.get(socket.id);
    const chatId = [user, otherUser].sort().join("-");
    const history = privateMessages.get(chatId) || [];
    socket.emit("message_history", { recipient: otherUser, messages: history });
  });

  socket.on("private_message", (data) => {
    const { recipient, message } = data;
    const sender = socketToUser.get(socket.id);
    const chatId = [sender, recipient].sort().join("-");
    const messageId = Date.now().toString();

    console.log(`📨 New message from ${sender} to ${recipient}`);

    const completeMessage: Message = {
      id: messageId,
      sender: sender as string,
      message: message,
      timestamp: new Date(),
      status: "sent",
    };

    if (!privateMessages.has(chatId)) {
      privateMessages.set(chatId, []);
    }
    privateMessages.get(chatId).push(completeMessage);

    const auditEntry: MessageAudit = {
      messageId,
      sender: sender as string,
      recipient,
      timestamp: new Date(),
      eventType: "sent",
    };

    if (!messageAudit.has(messageId)) {
      messageAudit.set(messageId, []);
    }
    messageAudit.get(messageId)?.push(auditEntry);

    const recipientSocketId = Array.from(socketToUser.entries()).find(
      ([_, username]) => username === recipient
    )?.[0];

    socket.emit("message_status", { messageId, status: "sent" });

    if (recipientSocketId) {
      io.to(recipientSocketId).emit("private_message", completeMessage);
      socket.emit("message_status", { messageId, status: "delivered" });

      messageAudit.get(messageId)?.push({
        ...auditEntry,
        timestamp: new Date(),
        eventType: "delivered",
      });

      console.log(`✔️ Message ${messageId} delivered to ${recipient}`);
    }
  });

  socket.on("message_read", (data) => {
    const { messageId, sender } = data;
    const senderSocketId = Array.from(socketToUser.entries()).find(
      ([_, username]) => username === sender
    )?.[0];

    const reader = socketToUser.get(socket.id);

    console.log(`👀 Message ${messageId} read by ${reader}`);

    const auditEntry = messageAudit
      .get(messageId)
      ?.find((e) => e.eventType === "sent");
    if (auditEntry) {
      messageAudit.get(messageId)?.push({
        ...auditEntry,
        timestamp: new Date(),
        eventType: "read",
      });
    }

    if (senderSocketId) {
      io.to(senderSocketId).emit("message_status", {
        messageId,
        status: "read",
      });
    }
  });

  socket.on("get_message_audit", (messageId) => {
    const audit = messageAudit.get(messageId);
    if (audit) {
      socket.emit("message_audit_data", audit);
    }
  });

  socket.on("get_users_status", () => {
    io.emit("users_status", Array.from(users.values()));
  });

  socket.on("disconnect", () => {
    const username = socketToUser.get(socket.id);
    if (username) {
      const user = users.get(username);
      if (user) {
        users.set(username, {
          ...user,
          isOnline: false,
          lastSeen: new Date(),
        });
      }
      socketToUser.delete(socket.id);
      io.emit("users_status", Array.from(users.values()));
    }
    console.log(`👋 ${username} has disconnected`);
  });
});

httpServer.listen(envConfig.port.PORT, () => {
  console.log(`Socket.IO server running on port ${envConfig.port.PORT}`);
});
