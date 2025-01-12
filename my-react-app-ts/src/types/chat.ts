export interface UserState {
  username: string;
  isOnline: boolean;
  lastSeen?: Date;
}

export interface Message {
  id: string;
  sender: string;
  message: string;
  timestamp: Date;
  status: "sent" | "delivered" | "read";
  recipient: string;
}

export interface MessageAudit {
  messageId: string;
  sender: string;
  recipient: string;
  timestamp: Date;
  eventType: "sent" | "delivered" | "read";
}
