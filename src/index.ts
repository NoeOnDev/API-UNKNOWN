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
  recipient: string;
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

    Array.from(privateMessages.entries()).forEach(([chatId, messages]) => {
      const [user1, user2] = chatId.split("-");
      if (user1 === username || user2 === username) {
        messages.forEach((msg: Message) => {
          if (msg.recipient === username && msg.status === "sent") {
            msg.status = "delivered";

            const senderSocketId = Array.from(socketToUser.entries()).find(
              ([_, user]) => user === msg.sender
            )?.[0];

            if (senderSocketId) {
              io.to(senderSocketId).emit("message_status", {
                messageId: msg.id,
                status: "delivered",
              });
            }
          }
        });
      }
    });

    io.emit("users_status", Array.from(users.values()));
    console.log(`👤 ${username} has joined the chat`);
  });

  socket.on("get_history", (otherUser) => {
    const user = socketToUser.get(socket.id);
    const chatId = [user, otherUser].sort().join("-");
    const history = privateMessages.get(chatId) || [];

    history.forEach((msg: Message) => {
      if (msg.recipient === user && msg.status === "sent") {
        msg.status = "delivered";

        const senderSocketId = Array.from(socketToUser.entries()).find(
          ([_, username]) => username === msg.sender
        )?.[0];

        if (senderSocketId) {
          io.to(senderSocketId).emit("message_status", {
            messageId: msg.id,
            status: "delivered",
          });
        }
      }
    });

    socket.emit("message_history", {
      recipient: otherUser,
      messages: history,
    });
  });

  socket.on("private_message", (data) => {
    const { recipient, message, messageId } = data;
    const sender = socketToUser.get(socket.id);
    const chatId = [sender, recipient].sort().join("-");

    console.log(`📨 New message from ${sender} to ${recipient}`);

    const completeMessage: Message = {
      id: messageId,
      sender: sender as string,
      message: message,
      timestamp: new Date(),
      status: "sent",
      recipient: recipient,
    };

    if (!privateMessages.has(chatId)) {
      privateMessages.set(chatId, []);
    }

    privateMessages.get(chatId).push(completeMessage);

    socket.emit("message_status", { messageId, status: "sent" });

    const recipientSocketId = Array.from(socketToUser.entries()).find(
      ([_, username]) => username === recipient
    )?.[0];

    if (recipientSocketId) {
      io.to(recipientSocketId).emit("private_message", completeMessage);

      completeMessage.status = "delivered";
      socket.emit("message_status", { messageId, status: "delivered" });

      const messages = privateMessages.get(chatId);
      const messageIndex: number = messages.findIndex(
        (m: Message) => m.id === messageId
      );
      if (messageIndex !== -1) {
        messages[messageIndex] = completeMessage;
      }

      console.log(`✔️ Message ${messageId} delivered to ${recipient}`);
    }
  });

  socket.on("message_read", (data) => {
    const { messageId, sender } = data;
    const reader = socketToUser.get(socket.id);
    const chatId = [sender, reader].sort().join("-");

    console.log(`👀 Message ${messageId} read by ${reader}`);

    const messages = privateMessages.get(chatId);
    if (messages) {
      const messageIndex = messages.findIndex(
        (m: Message) => m.id === messageId
      );
      if (messageIndex !== -1) {
        messages[messageIndex].status = "read";

        const senderSocketId = Array.from(socketToUser.entries()).find(
          ([_, username]) => username === sender
        )?.[0];

        if (senderSocketId) {
          io.to(senderSocketId).emit("message_status", {
            messageId,
            status: "read",
          });
        }
      }
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

  socket.on("get_all_histories", (username: string) => {
    const allHistories: { recipient: string; messages: Message[] }[] = [];

    Array.from(privateMessages.entries()).forEach(([chatId, messages]) => {
      const [user1, user2] = chatId.split("-");
      if (user1 === username || user2 === username) {
        const otherUser = user1 === username ? user2 : user1;
        allHistories.push({
          recipient: otherUser,
          messages: messages,
        });
      }
    });

    socket.emit("all_chat_histories", allHistories);
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
