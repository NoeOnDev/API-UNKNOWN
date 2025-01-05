const socket = io("http://localhost:3001");
let username = "";
let currentRecipient = "";
const conversations = new Map();

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
        .map(m => `
            <p class="${m.sender === username ? "own-message" : "other-message"}">
                ${m.message}
            </p>
        `)
        .join("");
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function updateRecipientHeader(user, usersList) {
    const recipientInfo = usersList.find(u => u.username === user);
    const headerName = document.getElementById("recipientName");
    const statusIndicator = document.getElementById("recipientStatus");
    
    if (recipientInfo) {
        headerName.textContent = recipientInfo.username;
        statusIndicator.className = `status-indicator ${recipientInfo.isOnline ? 'status-online' : 'status-offline'}`;
        statusIndicator.title = recipientInfo.isOnline ? 'Online' : `Last seen: ${new Date(recipientInfo.lastSeen).toLocaleTimeString()}`;
    }
}

socket.on("users_status", (usersList) => {
    const userList = document.getElementById("userList");
    const otherUsers = usersList.filter(user => user.username !== username);
    
    const sortedUsers = otherUsers.sort((a, b) => {
        if (a.isOnline !== b.isOnline) {
            return a.isOnline ? -1 : 1;
        }
        return a.username.localeCompare(b.username);
    });

    userList.innerHTML = sortedUsers
        .map(user => `
            <li onclick="selectUser('${user.username}')" class="user-item">
                <span class="status-indicator ${user.isOnline ? 'status-online' : 'status-offline'}"></span>
                <span>${user.username}</span>
                ${!user.isOnline && user.lastSeen ? `
                    <span class="last-seen">
                        Last seen: ${new Date(user.lastSeen).toLocaleTimeString()}
                    </span>
                ` : ''}
            </li>
        `)
        .join("");

    if (currentRecipient) {
        updateRecipientHeader(currentRecipient, usersList);
    }
});

function selectUser(user) {
    currentRecipient = user;
    socket.emit("get_history", user);
    updateMessageView();
    
    document.querySelectorAll('#userList li').forEach(li => {
        li.classList.remove('selected');
        if(li.querySelector('span:nth-child(2)').textContent === user) {
            li.classList.add('selected');
        }
    });

    const usersList = Array.from(document.querySelectorAll('#userList li')).map(li => ({
        username: li.querySelector('span:nth-child(2)').textContent,
        isOnline: li.querySelector('.status-indicator').classList.contains('status-online'),
        lastSeen: li.querySelector('.last-seen')?.textContent.replace('Last seen: ', '')
    }));
    
    updateRecipientHeader(user, usersList);
}

socket.on("message_history", (data) => {
  conversations.set(data.recipient, data.messages);
  if (data.recipient === currentRecipient) {
    updateMessageView();
  }
});

socket.on("private_message", (data) => {
  const otherUser = data.sender === username ? data.recipient : data.sender;
  if (!conversations.has(otherUser)) {
    conversations.set(otherUser, []);
  }
  conversations.get(otherUser).push(data);

  if (otherUser === currentRecipient) {
    updateMessageView();
  }
});

function sendPrivateMessage() {
  const message = document.getElementById("message").value;

  if (message.trim() && currentRecipient) {
    socket.emit("private_message", {
      recipient: currentRecipient,
      message: message,
    });
    document.getElementById("message").value = "";
  }
}

document.getElementById("recipient").addEventListener("change", (e) => {
  changeRecipient(e.target.value);
});
