import { FC } from 'react'

interface LoginProps {
    username: string
    setUsername: (username: string) => void
    onJoin: () => void
    isConnected: boolean
}

export const Login: FC<LoginProps> = ({ username, setUsername, onJoin, isConnected }) => {
    return (
        <div className="login" id="login">
            <input
                id="message"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your name"
            />
            <button onClick={onJoin} disabled={!isConnected}>
                Join Chat
            </button>
        </div>
    )
}