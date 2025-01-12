export const formatMessageTime = (timestamp: Date): string => {
  const messageDate = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24)
  );

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
};
