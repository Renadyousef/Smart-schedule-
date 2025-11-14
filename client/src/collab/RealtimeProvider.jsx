import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { connectRoom, disconnectRoom, getActiveRoom } from './yjsClient'

const RealtimeContext = createContext({ status: 'connecting', room: 'app' })

export const useRealtime = () => useContext(RealtimeContext)

const badgeBaseStyle = {
  position: 'fixed',
  bottom: '16px',
  right: '16px',
  padding: '8px 14px',
  borderRadius: '999px',
  color: '#fff',
  fontWeight: 600,
  fontSize: '0.85rem',
  boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
  zIndex: 1000,
}

export default function RealtimeProvider({ children }) {
  const [status, setStatus] = useState('connecting')
  const [room, setRoom] = useState(() => getActiveRoom())

  useEffect(() => {
    const provider = connectRoom()
    setRoom(getActiveRoom())
    setStatus(provider.wsconnected ? 'connected' : 'connecting')

    const handleStatus = (event) => {
      setStatus(event.status)
    }

    provider.on('status', handleStatus)

    return () => {
      provider.off?.('status', handleStatus)
      disconnectRoom()
    }
  }, [])

  const badgeStyle = useMemo(
    () => ({
      ...badgeBaseStyle,
      backgroundColor: status === 'connected' ? '#12b886' : '#fa5252',
    }),
    [status]
  )

  return (
    <RealtimeContext.Provider value={{ status, room }}>
      {children}
      <div style={badgeStyle}>Realtime: {status === 'connected' ? 'online' : 'offline'}</div>
    </RealtimeContext.Provider>
  )
}
