document.addEventListener("DOMContentLoaded", () => {
  const settingsIcon = document.getElementById("settings-icon");
  const settingsMenu = document.querySelector(".settings-menu");

  settingsIcon.addEventListener("click", (e) => {
    e.stopPropagation();
    settingsMenu.classList.toggle("active");
    updateThemeCheckmarks();
  });

  document.addEventListener("click", (e) => {
    if (!settingsMenu.contains(e.target) && !settingsIcon.contains(e.target)) {
      settingsMenu.classList.remove("active");
    }
  });

  initializeTheme();
});

function initializeTheme() {
  const savedTheme = localStorage.getItem("theme") || "system";
  changeTheme(savedTheme);
}

function changeTheme(theme) {
  localStorage.setItem("theme", theme);

  if (theme === "system") {
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
      .matches
      ? "dark"
      : "light";
    document.documentElement.setAttribute("data-theme", systemTheme);
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }

  updateThemeCheckmarks();
}

function updateThemeCheckmarks() {
  const currentTheme = localStorage.getItem("theme") || "system";
  const checks = document.querySelectorAll(".check-icon");

  checks.forEach((check) => check.classList.remove("active"));
  document.getElementById(`${currentTheme}-check`).classList.add("active");
}

window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", (e) => {
    if (localStorage.getItem("theme") === "system") {
      document.documentElement.setAttribute(
        "data-theme",
        e.matches ? "dark" : "light"
      );
    }
  });

const socket = io("http://localhost:3001");
let username = "";
let currentRecipient = "";
const conversations = new Map();

const messageStatuses = new Map();

const messageAuditLog = new Map();

let typingTimeout = null;

const users = new Map();

function logMessageEvent(messageId, event, details = {}) {
  if (!messageAuditLog.has(messageId)) {
    messageAuditLog.set(messageId, []);
  }

  messageAuditLog.get(messageId).push({
    timestamp: new Date(),
    event,
    details,
  });

  console.log(`📝 Message ${messageId}: ${event}`, details);
}

function joinChat() {
  username = document.getElementById("username").value;
  if (username.trim()) {
    socket.emit("join", username);
    document.getElementById("login").style.display = "none";
    document.getElementById("chat").style.display = "block";
    document.getElementById("userLabel").textContent = `Chat as: ${username}`;

    loadAllChatHistories();
  }
}

function loadAllChatHistories() {
  socket.emit("get_all_histories", username);
}

socket.on("all_chat_histories", (allHistories) => {
  conversations.clear();

  allHistories.forEach(({ recipient, messages }) => {
    conversations.set(recipient, messages);

    messages.forEach((message) => {
      if (message.sender === username) {
        messageStatuses.set(message.id, message.status);
      }
    });
  });

  socket.emit("get_users_status");
});

function changeRecipient(newRecipient) {
  currentRecipient = newRecipient;
  socket.emit("get_history", newRecipient);
  updateMessageView();
}

function updateMessageView() {
  const messagesDiv = document.getElementById("messages");
  const messages = conversations.get(currentRecipient) || [];
  messagesDiv.innerHTML = messages
    .map(
      (m) => `
        <div class="message">
          <div class="message-container ${
            m.sender === username ? "own" : "other"
          }">
            <div class="${
              m.sender === username ? "own-message" : "other-message"
            }">
              <div class="message-content">
                ${m.message}
              </div>
              <div class="message-footer">
                <span class="message-time">
                  ${new Date(m.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                ${
                  m.sender === username
                    ? `
                  <span class="message-status">
                    ${getMessageStatusIcon(m.id)}
                  </span>
                `
                    : ""
                }
              </div>
            </div>
          </div>
        </div>
      `
    )
    .join("");
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function getMessageStatusIcon(messageId) {
  const status = messageStatuses.get(messageId) || "sent";
  const icons = {
    sent: '<i class="fas fa-check" title="Send"></i>',
    delivered: '<i class="fas fa-check-double" title="Delivered"></i>',
    read: '<i class="fas fa-check-double text-blue" title="Read"></i>',
  };
  return icons[status];
}

function updateRecipientHeader(user, usersList) {
  const recipientInfo = usersList.find((u) => u.username === user);
  const headerName = document.getElementById("recipientName");
  const statusIndicator = document.getElementById("recipientStatus");

  if (recipientInfo) {
    const headerContainer = document.querySelector(".chat-header");
    headerContainer.innerHTML = `
      <div class="header-info">
        <h4 id="recipientName">${recipientInfo.username}</h4>
        <div class="status-container">
          <span class="status-indicator ${
            recipientInfo.isOnline ? "status-online" : "status-offline"
          }"></span>
          <span class="status-text">
            ${
              recipientInfo.isOnline
                ? "Online"
                : recipientInfo.lastSeen
                ? `Last seen: ${new Date(recipientInfo.lastSeen).toLocaleString(
                    [],
                    {
                      hour: "2-digit",
                      minute: "2-digit",
                      day: "2-digit",
                      month: "short",
                    }
                  )}`
                : "Offline"
            }
          </span>
        </div>
      </div>
    `;
  }
}

socket.on("users_status", (usersList) => {
  usersList.forEach((user) => {
    users.set(user.username, user);
  });

  const userList = document.getElementById("userList");
  const otherUsers = usersList.filter((user) => user.username !== username);

  const sortedUsers = otherUsers.sort((a, b) => {
    if (a.isOnline !== b.isOnline) {
      return a.isOnline ? -1 : 1;
    }
    return a.username.localeCompare(b.username);
  });

  userList.innerHTML = sortedUsers
    .map((user) => {
      const conversation = conversations.get(user.username) || [];
      const lastMessage = conversation[conversation.length - 1];

      const unreadCount =
        user.username !== currentRecipient
          ? conversation.filter(
              (msg) => msg.sender !== username && msg.status !== "read"
            ).length
          : 0;

      const unreadCounter =
        unreadCount > 0
          ? `<span class="unread-counter">${unreadCount}</span>`
          : "";

      const timeString = lastMessage
        ? formatMessageTime(lastMessage.timestamp)
        : "";

      const lastMessageContainer = lastMessage
        ? `<div class="last-message-container">
            <div class="last-message">
              ${
                lastMessage.sender === username
                  ? `
                <span class="last-message-status">
                  ${getMessageStatusIcon(lastMessage.id)}
                </span>
              `
                  : ""
              }
              ${
                lastMessage.sender === username ? "" : ""
              }${lastMessage.message.substring(0, 30)}${
            lastMessage.message.length > 30 ? "..." : ""
          }
            </div>
            ${unreadCounter}
          </div>`
        : `<div class="last-message-container">
            <div class="last-message empty">No messages yet</div>
            ${unreadCounter}
          </div>`;

      return `
          <li onclick="selectUser('${user.username}')" 
              class="user-item ${
                user.username === currentRecipient ? "selected" : ""
              }">
              <div class="user-info">
                <div class="user-header">
                  <div class="user-header-left">
                    <span class="status-indicator ${
                      user.isOnline ? "status-online" : "status-offline"
                    }"></span>
                    <span class="username">${user.username}</span>
                  </div>
                  ${
                    timeString
                      ? `<span class="last-message-time">${timeString}</span>`
                      : ""
                  }
                </div>
                ${lastMessageContainer}
              </div>
          </li>
        `;
    })
    .join("");

  if (currentRecipient) {
    updateRecipientHeader(currentRecipient, usersList);
  }
});

function formatMessageTime(timestamp) {
  const messageDate = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor((now - messageDate) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return messageDate.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return messageDate.toLocaleDateString([], {
      weekday: "short",
    });
  } else {
    return messageDate.toLocaleDateString([], {
      day: "2-digit",
      month: "short",
    });
  }
}

function markMessagesAsRead(messages) {
  const unreadMessages = messages.filter(
    (msg) => msg.sender !== username && msg.status !== "read"
  );

  if (unreadMessages.length > 0) {
    unreadMessages.forEach((msg) => {
      socket.emit("message_read", {
        messageId: msg.id,
        sender: msg.sender,
      });
      messageStatuses.set(msg.id, "read");

      const conversation = conversations.get(currentRecipient);
      const messageIndex = conversation.findIndex((m) => m.id === msg.id);
      if (messageIndex !== -1) {
        conversation[messageIndex].status = "read";
      }
    });

    socket.emit("get_users_status");
  }
}

function selectUser(user) {
  currentRecipient = user;
  socket.emit("get_history", user);
  updateMessageView();

  document.querySelectorAll(".user-item").forEach((li) => {
    li.classList.remove("selected");
    if (li.querySelector("span:nth-child(2)").textContent === user) {
      li.classList.add("selected");
    }
  });

  socket.emit("get_users_status");
}

socket.on("message_history", (data) => {
  conversations.set(data.recipient, data.messages);

  data.messages.forEach((message) => {
    if (message.sender === username) {
      messageStatuses.set(message.id, message.status);
    }
  });

  if (data.recipient === currentRecipient) {
    markMessagesAsRead(data.messages);
    updateMessageView();
  }
});

socket.on("message_status", ({ messageId, status }) => {
  messageStatuses.set(messageId, status);
  logMessageEvent(messageId, `Status changed to ${status}`);

  conversations.forEach((messages, recipient) => {
    const message = messages.find((m) => m.id === messageId);
    if (message) {
      message.status = status;
      if (recipient === currentRecipient) {
        updateMessageView();
      }
    }
  });
});

socket.on("private_message", (data) => {
  const otherUser = data.sender === username ? data.recipient : data.sender;

  if (!conversations.has(otherUser)) {
    conversations.set(otherUser, []);
  }
  conversations.get(otherUser).push(data);

  if (data.sender !== username && otherUser !== currentRecipient) {
    messageStatuses.set(data.id, "delivered");
  }

  socket.emit("get_users_status");

  if (otherUser === currentRecipient) {
    markMessagesAsRead([data]);
    updateMessageView();
  }
});

function sendPrivateMessage() {
  const message = document.getElementById("message").value;

  if (message.trim() && currentRecipient) {
    const messageId = Date.now().toString();
    const messageData = {
      recipient: currentRecipient,
      message: message,
      messageId: messageId,
    };

    const tempMessage = {
      id: messageId,
      sender: username,
      recipient: currentRecipient,
      message: message,
      timestamp: new Date(),
      status: "sent",
    };

    messageStatuses.set(messageId, "sent");

    if (!conversations.has(currentRecipient)) {
      conversations.set(currentRecipient, []);
    }
    conversations.get(currentRecipient).push(tempMessage);

    updateMessageView();

    console.log(`📤 Sending message to ${currentRecipient}:`, message);
    socket.emit("private_message", messageData);
    document.getElementById("message").value = "";
  }
}

function handleTyping() {
  if (currentRecipient) {
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }

    const messageInput = document.getElementById("message");
    if (messageInput.value.trim()) {
      socket.emit("typing", { recipient: currentRecipient });

      typingTimeout = setTimeout(() => {
        socket.emit("stop_typing", { recipient: currentRecipient });
      }, 2000);
    } else {
      socket.emit("stop_typing", { recipient: currentRecipient });
    }
  }
}

document.getElementById("message").addEventListener("input", handleTyping);

function viewMessageAudit(messageId) {
  socket.emit("get_message_audit", messageId);
}

socket.on("message_audit_data", (auditData) => {
  console.group(`📊 Message Audit Trail`);
  auditData.forEach((entry) => {
    console.log(
      `${entry.eventType.toUpperCase()} - ${new Date(
        entry.timestamp
      ).toLocaleString()}`
    );
    console.log(`From: ${entry.sender} To: ${entry.recipient}`);
  });
  console.groupEnd();
});

socket.on("get_users_status", () => {
  io.emit("users_status", Array.from(users.values()));
});

socket.on("user_typing", (data) => {
  if (data.sender === currentRecipient) {
    const statusText = document.querySelector(".status-text");
    if (statusText && !statusText.classList.contains("typing")) {
      statusText.innerHTML = `typing<div class="typing-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>`;
      statusText.classList.add("typing");
    }
  }
});

socket.on("user_stop_typing", (data) => {
  if (data.sender === currentRecipient) {
    const statusText = document.querySelector(".status-text");
    if (statusText) {
      const recipientInfo = users.get(currentRecipient);
      statusText.textContent = recipientInfo?.isOnline ? "Online" : "Offline";
      statusText.classList.remove("typing");
    }
  }
});

document.getElementById("message").addEventListener("keyup", (e) => {
  if (!e.target.value.trim()) {
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }
    socket.emit("stop_typing", { recipient: currentRecipient });
  }
});
