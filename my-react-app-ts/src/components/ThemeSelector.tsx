import { FC, useState, useEffect, useRef } from 'react'
import "../assets/styles/styles.css"

export const ThemeSelector: FC = () => {
    const [isOpen, setIsOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)
    const iconRef = useRef<HTMLElement>(null)

    useEffect(() => {
        const savedTheme = localStorage.getItem('theme') || 'system'
        changeTheme(savedTheme)

        // Manejar cambios en el tema del sistema
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        const handleChange = (e: MediaQueryListEvent) => {
            if (localStorage.getItem('theme') === 'system') {
                document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light')
            }
        }
        
        mediaQuery.addEventListener('change', handleChange)
        return () => mediaQuery.removeEventListener('change', handleChange)
    }, [])

    // Manejar clicks fuera del menú
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && iconRef.current && 
                !menuRef.current.contains(e.target as Node) && 
                !iconRef.current.contains(e.target as Node)) {
                setIsOpen(false)
            }
        }

        document.addEventListener('click', handleClickOutside)
        return () => document.removeEventListener('click', handleClickOutside)
    }, [])

    const changeTheme = (theme: string) => {
        localStorage.setItem('theme', theme)

        if (theme === 'system') {
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
                ? 'dark'
                : 'light'
            document.documentElement.setAttribute('data-theme', systemTheme)
        } else {
            document.documentElement.setAttribute('data-theme', theme)
        }
    }

    return (
        <div className="settings-button">
            <i
                className="fas fa-cog"
                id="settings-icon"
                onClick={() => setIsOpen(!isOpen)}
                ref={iconRef}
            />
            <div className={`settings-menu ${isOpen ? 'active' : ''}`} ref={menuRef}>
                <div className="settings-header">
                    <h4>Settings</h4>
                </div>
                <div className="settings-content">
                    <div className="settings-section">
                        <h5>Theme</h5>
                        <div className="theme-options">
                            {['light', 'dark', 'system'].map(theme => (
                                <div
                                    key={theme}
                                    className="theme-option"
                                    onClick={() => changeTheme(theme)}
                                >
                                    <i className={`fas fa-${theme === 'light' ? 'sun' :
                                            theme === 'dark' ? 'moon' : 'desktop'
                                        }`} />
                                    <span>{theme.charAt(0).toUpperCase() + theme.slice(1)}</span>
                                    <i className={`fas fa-check check-icon ${localStorage.getItem('theme') === theme ? 'active' : ''
                                        }`} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}