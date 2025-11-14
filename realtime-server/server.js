// realtime-server/server.js
// Realtime Yjs backend for SmartSchedule
// Works for Docker (localhost) and Railway (production)
// Accepts /yjs and /yjs/<room> connections

const http = require('http')
const express = require('express')
const { WebSocketServer } = require('ws')
const { setupWSConnection } = require('y-websocket/bin/utils')

const PORT = process.env.PORT || 3001
const app = express()

// Health check endpoint
app.get('/', (_req, res) => {
  res.type('text/plain').send('Yjs realtime is up')
})

// Create HTTP server
const server = http.createServer(app)

// WebSocket server (noServer lets us manually upgrade requests)
const wss = new WebSocketServer({ noServer: true })

// Handle WebSocket upgrade requests
server.on('upgrade', (request, socket, head) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`)
    if (!url.pathname.startsWith('/yjs')) {
      socket.destroy()
      return
    }

    const pathParts = url.pathname.split('/').filter(Boolean)
    let room = url.searchParams.get('room')

    if (!room && pathParts.length > 1) {
      room = decodeURIComponent(pathParts.slice(1).join('/'))
    }

    const resolvedRoom = room && room.trim().length ? room.trim() : 'app'
    request.url = `/${encodeURIComponent(resolvedRoom)}`

    wss.handleUpgrade(request, socket, head, ws => {
      wss.emit('connection', ws, request)
    })
  } catch (err) {
    console.error('Upgrade error:', err)
    socket.destroy()
  }
})

// On successful WebSocket connection
wss.on('connection', (ws, req) => {
  setupWSConnection(ws, req, { gc: true })
  const { url } = req
  console.log(`🔗 New Yjs connection: ${url}`)
})

// Listen on all interfaces so Docker can expose it
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ y-websocket on ${PORT}`)
  if (Number(PORT) !== 3001) {
    console.log(`listening on ${PORT}`)
  }
})
