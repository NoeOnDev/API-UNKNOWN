import { FC, useState, useEffect, useRef } from 'react'
import { Socket } from 'socket.io-client'
import { Message, UserState } from '../types/chat'
import { formatMessageTime } from '../utils/dateFormat'
import "../assets/styles/styles.css"

interface MessageAreaProps {
    socket: Socket | null
    currentRecipient: string
    username: string
    conversations: Map<string, Message[]>
    setConversations: (conversations: Map<string, Message[]>) => void
    messageStatuses: Map<string, string>
    setMessageStatuses: (statuses: Map<string, string>) => voidz
    typingUsers: Set<string>
    users: UserState[]
}

export const MessageArea: FC<MessageAreaProps> = ({
    socket,
    currentRecipient,
    username,
    conversations,
    setConversations,
    messageStatuses,
    setMessageStatuses,
    typingUsers,
    users
}) => {
    const [message, setMessage] = useState('')
    const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const [messageHistory, setMessageHistory] = useState<Message[]>([])

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(scrollToBottom, [conversations.get(currentRecipient)])

    useEffect(() => {
        if (!socket) return

        socket.on('message_status', ({ messageId, status }) => {
            setMessageStatuses(prev => {
                const newStatuses = new Map(prev)
                newStatuses.set(messageId, status)
                return newStatuses
            })
        })

        socket.on('message_history', (data) => {
            if (data.recipient === currentRecipient) {
                const newConversations = new Map(conversations)
                newConversations.set(data.recipient, data.messages)
                setConversations(newConversations)
                markMessagesAsRead(data.messages)
            }
        })

        return () => {
            socket.off('message_status')
            socket.off('message_history')
        }
    }, [socket, currentRecipient])

    useEffect(() => {
        if (!socket || !currentRecipient) return

        socket.on('message_history', (data) => {
            if (data.recipient === currentRecipient) {
                setMessageHistory(data.messages)
                markMessagesAsRead(data.messages)
            }
        })

        return () => {
            socket.off('message_history')
        }
    }, [socket, currentRecipient])

    const getMessageStatusIcon = (messageId: string) => {
        const status = messageStatuses.get(messageId) || 'sent'
        const icons = {
            sent: <i className="fas fa-check" title="Sent" />,
            delivered: <i className="fas fa-check-double" title="Delivered" />,
            read: <i className="fas fa-check-double text-blue" title="Read" />
        }
        return icons[status as keyof typeof icons]
    }

    const markMessagesAsRead = (messages: Message[]) => {
        const unreadMessages = messages.filter(
            msg => msg.sender !== username && msg.status !== 'read'
        )

        if (unreadMessages.length > 0 && socket) {
            unreadMessages.forEach(msg => {
                socket.emit('message_read', {
                    messageId: msg.id,
                    sender: msg.sender
                })

                setMessageStatuses(prev => {
                    const newStatuses = new Map(prev)
                    newStatuses.set(msg.id, 'read')
                    return newStatuses
                })

                setConversations(prev => {
                    const newConversations = new Map(prev)
                    const conversation = newConversations.get(currentRecipient)
                    if (conversation) {
                        const messageIndex = conversation.findIndex(m => m.id === msg.id)
                        if (messageIndex !== -1) {
                            conversation[messageIndex] = {
                                ...conversation[messageIndex],
                                status: 'read'
                            }
                        }
                    }
                    return newConversations
                })
            })
        }
    }

    useEffect(() => {
        if (currentRecipient && conversations.get(currentRecipient)) {
            markMessagesAsRead(conversations.get(currentRecipient) || [])
        }
    }, [currentRecipient, conversations])

    const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
        setMessage(e.target.value)

        if (!currentRecipient || !socket) return

        if (typingTimeout) {
            clearTimeout(typingTimeout)
        }

        if (e.target.value.trim()) {
            socket.emit('typing', { recipient: currentRecipient })

            const timeout = setTimeout(() => {
                socket.emit('stop_typing', { recipient: currentRecipient })
            }, 2000)

            setTypingTimeout(timeout)
        } else {
            socket.emit('stop_typing', { recipient: currentRecipient })
        }
    }

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSendMessage()
        }
    }

    const handleSendMessage = () => {
        if (!message.trim() || !currentRecipient || !socket) return

        const messageId = Date.now().toString()
        const messageData = {
            recipient: currentRecipient,
            message: message.trim(),
            messageId
        }

        const tempMessage: Message = {
            id: messageId,
            sender: username,
            recipient: currentRecipient,
            message: message.trim(),
            timestamp: new Date(),
            status: 'sent'
        }

        setConversations(prev => {
            const newConversations = new Map(prev)
            const currentMessages = newConversations.get(currentRecipient) || []
            newConversations.set(currentRecipient, [...currentMessages, tempMessage])
            return newConversations
        })

        setMessageStatuses(prev => {
            const newStatuses = new Map(prev)
            newStatuses.set(messageId, 'sent')
            return newStatuses
        })

        socket.emit('private_message', messageData)
        setMessage('')
    }

    const recipientInfo = users.find(u => u.username === currentRecipient)
    const isTyping = typingUsers.has(currentRecipient)

    return (
        <div className="message-area">
            <div className="chat-header">
                {recipientInfo && (
                    <div className="header-info">
                        <h4 id="recipientName">{recipientInfo.username}</h4>
                        <div className="status-container">
                            <span className={`status-indicator ${recipientInfo.isOnline ? 'status-online' : 'status-offline'}`} />
                            <span className={`status-text ${isTyping ? 'typing' : ''}`}>
                                {isTyping ? (
                                    <>
                                        typing
                                        <div className="typing-dots">
                                            <span></span>
                                            <span></span>
                                            <span></span>
                                        </div>
                                    </>
                                ) : (
                                    recipientInfo.isOnline ? 'Online' :
                                        recipientInfo.lastSeen ? `Last seen: ${formatMessageTime(recipientInfo.lastSeen)}` :
                                            'Offline'
                                )}
                            </span>
                        </div>
                    </div>
                )}
            </div>
            <div id="messages">
                {currentRecipient && conversations.get(currentRecipient)?.map((msg) => (
                    <div key={msg.id} className="message">
                        <div className={`message-container ${msg.sender === username ? 'own' : 'other'}`}>
                            <div className={msg.sender === username ? 'own-message' : 'other-message'}>
                                <div className="message-content">
                                    {msg.message}
                                </div>
                                <div className="message-footer">
                                    <span className="message-time">
                                        {formatMessageTime(msg.timestamp)}
                                    </span>
                                    {msg.sender === username && (
                                        <span className="message-status">
                                            {getMessageStatusIcon(msg.id)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            <div className="input-container">
                <input
                    id="message"
                    type="text"
                    value={message}
                    onChange={handleTyping}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your message"
                />
                <button onClick={handleSendMessage} title="Send Message">
                    <i className="fas fa-paper-plane"></i>
                </button>
            </div>
        </div>
    )
}