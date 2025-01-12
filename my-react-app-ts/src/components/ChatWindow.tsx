import { FC, useState, useEffect } from 'react'
import { Socket } from 'socket.io-client'
import { UserList } from './UserList'
import { MessageArea } from './MessageArea'
import { ThemeSelector } from './ThemeSelector'
import { UserState, Message } from '../types/chat'
import "../assets/styles/styles.css"

interface ChatWindowProps {
    socket: Socket | null
    username: string
    users: UserState[]
}

export const ChatWindow: FC<ChatWindowProps> = ({ socket, username, users }) => {
    const [currentRecipient, setCurrentRecipient] = useState<string>('')
    const [conversations, setConversations] = useState<Map<string, Message[]>>(new Map())
    const [messageStatuses, setMessageStatuses] = useState<Map<string, string>>(new Map())
    const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())

    useEffect(() => {
        if (socket && username) {
            socket.emit('get_all_histories', username);
        }
    }, [socket, username]);

    useEffect(() => {
        if (!socket) return

        if (currentRecipient) {
            socket.emit('get_history', currentRecipient)
        }

        socket.on('private_message', (data) => {
            const otherUser = data.sender === username ? data.recipient : data.sender

            setConversations(prev => {
                const newConversations = new Map(prev)
                const currentMessages = newConversations.get(otherUser) || []
                // Verificar si el mensaje ya existe
                const messageExists = currentMessages.some(m => m.id === data.id)
                
                if (!messageExists) {
                    // Ordenar mensajes por timestamp
                    const updatedMessages = [...currentMessages, data].sort((a, b) =>
                        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                    );
                    newConversations.set(otherUser, updatedMessages);
                }
                return newConversations
            })

            if (data.sender !== username) {
                setMessageStatuses(prev => {
                    const newStatuses = new Map(prev)
                    newStatuses.set(data.id, data.status || 'delivered')
                    return newStatuses
                })

                socket.emit('message_delivered', {
                    messageId: data.id,
                    sender: data.sender
                })
            }
        })

        socket.on('message_status', ({ messageId, status }) => {
            setMessageStatuses(prev => {
                const newStatuses = new Map(prev)
                newStatuses.set(messageId, status)
                return newStatuses
            })

            setConversations(prev => {
                const newConversations = new Map(prev)
                newConversations.forEach((messages, recipient) => {
                    const messageIndex = messages.findIndex(m => m.id === messageId)
                    if (messageIndex !== -1) {
                        const updatedMessages = [...messages]
                        updatedMessages[messageIndex] = {
                            ...updatedMessages[messageIndex],
                            status: status
                        }
                        newConversations.set(recipient, updatedMessages)
                    }
                })
                return newConversations
            })
        })

        socket.on('user_typing', (data) => {
            setTypingUsers(prev => new Set([...prev, data.sender]))
        })

        socket.on('user_stop_typing', (data) => {
            setTypingUsers(prev => {
                const newTyping = new Set(prev)
                newTyping.delete(data.sender)
                return newTyping
            })
        })

        return () => {
            socket.off('private_message')
            socket.off('message_status')
            socket.off('user_typing')
            socket.off('user_stop_typing')
        }
    }, [socket, username, currentRecipient])

    useEffect(() => {
        if (!socket) return;

        socket.on('private_message', (data) => {
            const otherUser = data.sender === username ? data.recipient : data.sender;

            setConversations(prev => {
                const newConversations = new Map(prev);
                const currentMessages = newConversations.get(otherUser) || [];
                const messageExists = currentMessages.some(m => m.id === data.id);
                
                if (!messageExists) {
                    const updatedMessages = [...currentMessages, data].sort((a, b) =>
                        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                    );
                    newConversations.set(otherUser, updatedMessages);
                }
                return newConversations;
            });

            if (data.sender !== username) {
                setMessageStatuses(prev => {
                    const newStatuses = new Map(prev);
                    newStatuses.set(data.id, data.status || 'delivered');
                    return newStatuses;
                });
            }
        });

        socket.on('message_status', ({ messageId, status }) => {
            setMessageStatuses(prev => {
                const newStatuses = new Map(prev);
                newStatuses.set(messageId, status);
                return newStatuses;
            });
        });
    }, [socket, username]);

    return (
        <div id="chat">
            <div className="chat-container">
                <div className="users-section">
                    <div className="users-header">
                        <h3 id="userLabel">Chat as: {username}</h3>
                        <ThemeSelector />
                    </div>
                    <UserList
                        users={users}
                        currentUser={username}
                        currentRecipient={currentRecipient}
                        setCurrentRecipient={setCurrentRecipient}
                        conversations={conversations}
                        typingUsers={typingUsers}
                        messageStatuses={messageStatuses}
                    />
                </div>
                <MessageArea
                    socket={socket}
                    currentRecipient={currentRecipient}
                    username={username}
                    conversations={conversations}
                    setConversations={setConversations}
                    messageStatuses={messageStatuses}
                    setMessageStatuses={setMessageStatuses}
                    typingUsers={typingUsers}
                    users={users}
                />
            </div>
        </div>
    )
}