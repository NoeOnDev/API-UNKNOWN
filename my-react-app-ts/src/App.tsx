import { useState, useEffect } from 'react'
import { Socket, io } from 'socket.io-client'
import { Login } from './components/Login'
import { ChatWindow } from './components/ChatWindow'
import { UserState } from './types/chat'
import "./assets/styles/styles.css"

const SOCKET_URL = 'http://localhost:3001'

function App() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [username, setUsername] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [users, setUsers] = useState<UserState[]>([])
  const [conversations, setConversations] = useState(new Map())
  const [messageStatuses, setMessageStatuses] = useState(new Map())

  useEffect(() => {
    const newSocket = io(SOCKET_URL)

    newSocket.on('connect', () => {
      console.log('Connected to server')
      setIsConnected(true)
    })

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server')
      setIsConnected(false)
    })

    newSocket.on('users_status', (userList: UserState[]) => {
      setUsers(userList)
    })

    setSocket(newSocket)

    return () => {
      newSocket.disconnect()
    }
  }, [])

  useEffect(() => {
    if (socket && isLoggedIn) {
        socket.emit('get_all_histories', username);

        socket.on('all_chat_histories', (allHistories) => {
            const newConversations = new Map();
            const newMessageStatuses = new Map();

            allHistories.forEach(({ recipient, messages }) => {
                if (messages && messages.length > 0) {
                    // Asegurarse que los mensajes están ordenados correctamente
                    const sortedMessages = [...messages].sort((a, b) => 
                        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                    );
                    
                    newConversations.set(recipient, sortedMessages);
                    
                    // Actualizar estados de todos los mensajes
                    messages.forEach(message => {
                        // Mantener el estado real del mensaje
                        newMessageStatuses.set(message.id, message.status);
                    });
                }
            });

            setConversations(newConversations);
            setMessageStatuses(newMessageStatuses);
        });

        return () => {
            socket.off('all_chat_histories');
        };
    }
}, [socket, isLoggedIn, username]);

  const handleJoin = () => {
    if (socket && username.trim()) {
      socket.emit('join', username)
      setIsLoggedIn(true)
    }
  }

  return (
    <>
      {!isLoggedIn ? (
        <Login
          username={username}
          setUsername={setUsername}
          onJoin={handleJoin}
          isConnected={isConnected}
        />
      ) : (
        <ChatWindow
          socket={socket}
          username={username}
          users={users}
        />
      )}
    </>
  )
}

export default App