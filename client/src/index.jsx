import App from './App.jsx'
import RealtimeProvider from './collab/RealtimeProvider.jsx'

export default function Root() {
  return (
    <RealtimeProvider>
      <App />
    </RealtimeProvider>
  )
}
