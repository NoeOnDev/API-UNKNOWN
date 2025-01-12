import { FC } from 'react'
import { UserState, Message } from '../types/chat'
import { formatMessageTime } from '../utils/dateFormat'
import "../assets/styles/styles.css"

interface UserListProps {
    users: UserState[]
    currentUser: string
    currentRecipient: string
    setCurrentRecipient: (recipient: string) => void
    conversations: Map<string, Message[]>
    typingUsers: Set<string>
    messageStatuses: Map<string, string>
}

export const UserList: FC<UserListProps> = ({
    users,
    currentUser,
    currentRecipient,
    setCurrentRecipient,
    conversations,
    typingUsers,
    messageStatuses,
}) => {
    const getMessageStatusIcon = (messageId: string) => {
        const status = messageStatuses.get(messageId) || 'sent'
        const icons = {
            sent: <i className="fas fa-check" title="Sent" />,
            delivered: <i className="fas fa-check-double" title="Delivered" />,
            read: <i className="fas fa-check-double text-blue" title="Read" />,
        }
        return icons[status as keyof typeof icons]
    }

    const getLastMessage = (conversation: Message[]) => {
        if (!conversation || conversation.length === 0) return null;
        
        // Asegurarse de obtener el último mensaje por timestamp
        return [...conversation].sort((a, b) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )[0];
    }

    const sortedUsers = users
        .filter(user => user.username !== currentUser)
        .sort((a, b) => {
            if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1
            return a.username.localeCompare(b.username)
        })

    return (
        <>
            <h4>Users:</h4>
            <div className="status-legend">
                <span><span className="status-indicator status-online"></span> Online</span>
                <span><span className="status-indicator status-offline"></span> Offline</span>
            </div>
            <ul id="userList">
                {sortedUsers.map(user => {
                    const conversation = conversations.get(user.username) || []
                    const lastMessage = getLastMessage(conversation)
                    const isTyping = typingUsers.has(user.username)

                    // Calcular mensajes no leídos
                    const unreadCount =
                        user.username !== currentRecipient
                            ? conversation.filter(
                                msg => msg.sender !== currentUser && msg.status !== 'read'
                            ).length
                            : 0

                    return (
                        <li
                            key={user.username}
                            onClick={() => setCurrentRecipient(user.username)}
                            className={`user-item ${user.username === currentRecipient ? 'selected' : ''}`}
                        >
                            <div className="user-info">
                                <div className="user-header">
                                    <div className="user-header-left">
                                        <span className={`status-indicator ${user.isOnline ? 'status-online' : 'status-offline'}`} />
                                        <span className="username">{user.username}</span>
                                    </div>
                                    {lastMessage && (
                                        <span className="last-message-time">
                                            {formatMessageTime(lastMessage.timestamp)}
                                        </span>
                                    )}
                                </div>
                                {/* Contenedor del último mensaje */}
                                <div className="last-message-container">
                                    {isTyping ? (
                                        <div className="last-message typing" data-typing={user.username}>
                                            typing
                                            <div className="typing-dots">
                                                <span></span>
                                                <span></span>
                                                <span></span>
                                            </div>
                                        </div>
                                    ) : lastMessage ? (
                                        <div className="last-message">
                                            {lastMessage.sender === currentUser && (
                                                <span className="last-message-status">
                                                    {getMessageStatusIcon(lastMessage.id)}
                                                </span>
                                            )}
                                            {lastMessage.message.substring(0, 30)}
                                            {lastMessage.message.length > 30 ? '...' : ''}
                                        </div>
                                    ) : (
                                        <div className="last-message empty">No messages yet</div>
                                    )}
                                    {unreadCount > 0 && (
                                        <span className="unread-counter">{unreadCount}</span>
                                    )}
                                </div>
                            </div>
                        </li>
                    )
                })}
            </ul>
        </>
    )
}