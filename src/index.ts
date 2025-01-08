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

const users = new Map<string, UserState>();
const socketToUser = new Map<string, string>();

const privateMessages = new Map();

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

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
    console.log(`${username} has joined the chat`);
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

    const completeMessage = {
      sender: sender,
      message: message,
      timestamp: new Date(),
    };

    if (!privateMessages.has(chatId)) {
      privateMessages.set(chatId, []);
    }
    privateMessages.get(chatId).push(completeMessage);

    const recipientSocketId = Array.from(socketToUser.entries()).find(
      ([_, username]) => username === recipient
    )?.[0];

    if (recipientSocketId) {
      io.to(recipientSocketId).to(socket.id).emit("private_message", {
        sender: sender,
        message: message,
        recipient: recipient,
      });
    }
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
    console.log(`${username} has disconnected`);
  });
});

httpServer.listen(envConfig.port.PORT, () => {
  console.log(`Socket.IO server running on port ${envConfig.port.PORT}`);
});
