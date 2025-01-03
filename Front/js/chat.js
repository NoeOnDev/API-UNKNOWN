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
    .map(
      (m) => `
                <p class="${
                  m.sender === username ? "own-message" : "other-message"
                }">
                    <strong>${m.sender}:</strong> ${m.message}
                </p>
            `
    )
    .join("");
}

socket.on("connected_users", (users) => {
  const userList = document.getElementById("userList");
  const recipientSelect = document.getElementById("recipient");

  const otherUsers = users.filter((user) => user !== username);

  userList.innerHTML = otherUsers.map((user) => `<li>${user}</li>`).join("");

  recipientSelect.innerHTML =
    '<option value="">Select a recipient</option>' +
    otherUsers
      .map((user) => `<option value="${user}">${user}</option>`)
      .join("");
});

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
  const recipient = document.getElementById("recipient").value;

  if (message.trim() && recipient) {
    socket.emit("private_message", {
      recipient: recipient,
      message: message,
    });
    document.getElementById("message").value = "";
  }
}

document.getElementById("recipient").addEventListener("change", (e) => {
  changeRecipient(e.target.value);
});
