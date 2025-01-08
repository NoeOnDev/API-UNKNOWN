const currentTheme = localStorage.getItem("theme") || "light";
document.documentElement.setAttribute("data-theme", currentTheme);
updateThemeIcon(currentTheme);

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute("data-theme");
  const newTheme = currentTheme === "light" ? "dark" : "light";

  document.documentElement.setAttribute("data-theme", newTheme);
  localStorage.setItem("theme", newTheme);
  updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
  const icon = document.getElementById("theme-icon");
  if (theme === "dark") {
    icon.classList.remove("fa-moon");
    icon.classList.add("fa-sun");
  } else {
    icon.classList.remove("fa-sun");
    icon.classList.add("fa-moon");
  }
}

const socket = io("http://localhost:3001");
let username = "";
let currentRecipient = "";
const conversations = new Map();

const messageStatuses = new Map();

const messageAuditLog = new Map();

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
  }
}

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
    sent: '<i class="fas fa-check" title="Enviado"></i>',
    delivered: '<i class="fas fa-check-double" title="Entregado"></i>',
    read: '<i class="fas fa-check-double text-blue" title="Leído"></i>',
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
  const userList = document.getElementById("userList");
  const otherUsers = usersList.filter((user) => user.username !== username);

  const sortedUsers = otherUsers.sort((a, b) => {
    if (a.isOnline !== b.isOnline) {
      return a.isOnline ? -1 : 1;
    }
    return a.username.localeCompare(b.username);
  });

  userList.innerHTML = sortedUsers
    .map(
      (user) => `
      <li onclick="selectUser('${user.username}')" class="user-item">
        <span class="status-indicator ${
          user.isOnline ? "status-online" : "status-offline"
        }"></span>
        <span>${user.username}</span>
      </li>
    `
    )
    .join("");

  if (currentRecipient) {
    const recipientInfo = usersList.find(u => u.username === currentRecipient);
    if (recipientInfo) {
      updateRecipientHeader(currentRecipient, usersList);
    }
  }
});

function selectUser(user) {
  currentRecipient = user;
  socket.emit("get_history", user);
  updateMessageView();

  document.querySelectorAll("#userList li").forEach((li) => {
    li.classList.remove("selected");
    if (li.querySelector("span:nth-child(2)").textContent === user) {
      li.classList.add("selected");
    }
  });

  socket.emit("get_users_status");
}

socket.on("message_history", (data) => {
  conversations.set(data.recipient, data.messages);
  if (data.recipient === currentRecipient) {
    updateMessageView();
  }
});

socket.on("message_status", ({ messageId, status }) => {
  messageStatuses.set(messageId, status);
  logMessageEvent(messageId, `Status changed to ${status}`);
  updateMessageView();
});

socket.on("private_message", (data) => {
  const otherUser = data.sender === username ? data.recipient : data.sender;

  logMessageEvent(data.id, "Message received", {
    from: data.sender,
    to: otherUser,
    timestamp: data.timestamp,
  });

  if (!conversations.has(otherUser)) {
    conversations.set(otherUser, []);
  }
  conversations.get(otherUser).push(data);

  if (data.sender !== username && otherUser === currentRecipient) {
    socket.emit("message_read", { messageId: data.id, sender: data.sender });
    logMessageEvent(data.id, "Marked as read");
  }

  if (otherUser === currentRecipient) {
    updateMessageView();
  }
});

function sendPrivateMessage() {
  const message = document.getElementById("message").value;

  if (message.trim() && currentRecipient) {
    const messageData = {
      recipient: currentRecipient,
      message: message,
    };

    const tempMessage = {
      id: Date.now().toString(),
      sender: username,
      recipient: currentRecipient,
      message: message,
      timestamp: new Date(),
      status: "sent",
    };

    if (!conversations.has(currentRecipient)) {
      conversations.set(currentRecipient, []);
    }
    conversations.get(currentRecipient).push(tempMessage);

    updateMessageView();

    console.log(`📤 Sending message to ${currentRecipient}:`, message);
    socket.emit("private_message", messageData);
    document.getElementById("message").value = "";

    const messagesDiv = document.getElementById("messages");
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }
}

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
