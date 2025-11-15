import { useCallback, useEffect, useState } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'

const getWindow = () => (typeof window === 'undefined' ? undefined : window)
const globalScope = getWindow() || globalThis

const resolveDoc = () => {
  if (globalScope.__smartScheduleYDoc) {
    return globalScope.__smartScheduleYDoc
  }
  const instance = new Y.Doc()
  globalScope.__smartScheduleYDoc = instance
  return instance
}

const doc = resolveDoc()
const yShared = doc.getMap('shared')
const ySchedule = doc.getMap('schedule')

const ensureScheduleArray = (key) => {
  const current = ySchedule.get(key)
  if (current instanceof Y.Array) {
    return current
  }
  const next = new Y.Array()
  if (current !== undefined) {
    next.push([current])
  }
  ySchedule.set(key, next)
  return next
}

const ensureScheduleMap = (key) => {
  const current = ySchedule.get(key)
  if (current instanceof Y.Map) {
    return current
  }
  const next = new Y.Map()
  if (current && typeof current === 'object') {
    Object.entries(current).forEach(([entryKey, value]) => {
      next.set(entryKey, value)
    })
  }
  ySchedule.set(key, next)
  return next
}

const scheduleListArray = ensureScheduleArray('list')
const scheduleCommentsArray = ensureScheduleArray('comments')
const historyListArray = ensureScheduleArray('historyList')
const historySnapshotsMap = ensureScheduleMap('historySnapshots')
const scheduleDraftsRootMap = ensureScheduleMap('editorDrafts')
const schedulePresenceRootMap = ensureScheduleMap('editorPresence')

const gridKey = (scheduleId) => (scheduleId === null || scheduleId === undefined ? 'grid:global' : `grid:${scheduleId}`)
const scopeKey = (scheduleId) => (scheduleId === null || scheduleId === undefined ? 'global' : String(scheduleId))

const ensureNestedMap = (parent, key) => {
  if (!(parent instanceof Y.Map)) {
    return undefined
  }
  const existing = parent.get(key)
  if (existing instanceof Y.Map) {
    return existing
  }
  const next = new Y.Map()
  if (existing && typeof existing === 'object') {
    Object.entries(existing).forEach(([entryKey, value]) => {
      next.set(entryKey, value)
    })
  }
  parent.set(key, next)
  return next
}

const readQueryParam = (key) => {
  const w = getWindow()
  if (!w) return null
  const params = new URLSearchParams(w.location.search)
  const value = params.get(key)
  return value && value.trim().length ? value.trim() : null
}

const getEnvValue = (...keys) => {
  const importEnv = typeof import.meta !== 'undefined' ? import.meta.env ?? {} : {}
  for (const key of keys) {
    const candidate = importEnv[key]
    if (candidate && String(candidate).trim().length) {
      return String(candidate).trim()
    }
  }
  const nodeEnv = typeof process !== 'undefined' ? process.env ?? {} : {}
  for (const key of keys) {
    const candidate = nodeEnv[key]
    if (candidate && String(candidate).trim().length) {
      return String(candidate).trim()
    }
  }
  return null
}

const resolveWsEndpoint = () => {
  const fromQuery = readQueryParam('ws')
  if (fromQuery) {
    return fromQuery
  }
  const fromEnv = getEnvValue('VITE_WS_URL', 'REACT_APP_WS_URL')
  if (fromEnv) {
    return fromEnv
  }
  return 'ws://localhost:3001/yjs'
}

const detectRoom = () => {
  const fromQuery = readQueryParam('room')
  if (fromQuery) {
    return fromQuery
  }
  const envRoom = getEnvValue('VITE_WS_ROOM', 'REACT_APP_WS_ROOM')
  if (envRoom) {
    return envRoom
  }
  const w = getWindow()
  if (w) {
    const segments = w.location.pathname.split('/').filter(Boolean)
    const last = segments[segments.length - 1]
    if (last) return last
  }
  return 'app'
}

const wsEndpoint = resolveWsEndpoint()
let currentRoom = detectRoom()
let provider

export const connectRoom = (roomId) => {
  const targetRoom = roomId || detectRoom()
  if (provider && currentRoom === targetRoom) {
    return provider
  }
  if (provider) {
    provider.destroy()
    provider = null
  }
  provider = new WebsocketProvider(wsEndpoint, targetRoom, doc, {
    connect: true,
    params: {
      room: targetRoom,
    },
  })
  currentRoom = targetRoom
  return provider
}

export const getActiveRoom = () => currentRoom

export const disconnectRoom = () => {
  if (provider) {
    provider.destroy()
    provider = null
  }
}

export const getScheduleListArray = () => scheduleListArray
export const getScheduleCommentsArray = () => scheduleCommentsArray
export const getHistoryListArray = () => historyListArray
export const getHistorySnapshotsMap = () => historySnapshotsMap
export const getScheduleGridArray = (scheduleId) => ensureScheduleArray(gridKey(scheduleId))
export const getScheduleDraftMap = (scheduleId) => ensureNestedMap(scheduleDraftsRootMap, scopeKey(scheduleId))
export const getSchedulePresenceMap = (scheduleId) => ensureNestedMap(schedulePresenceRootMap, scopeKey(scheduleId))
export { doc, yShared, ySchedule }

export const useYShared = (key, initialValue) => {
  const [value, setValue] = useState(() => {
    if (yShared.has(key)) {
      return yShared.get(key)
    }
    if (typeof initialValue !== 'undefined') {
      yShared.set(key, initialValue)
      return initialValue
    }
    return undefined
  })

  useEffect(() => {
    const handleChange = (event) => {
      if (event.keysChanged.has(key)) {
        setValue(yShared.get(key))
      }
    }
    yShared.observe(handleChange)
    return () => {
      yShared.unobserve(handleChange)
    }
  }, [key])

  const update = useCallback(
    (next) => {
      const previous = yShared.get(key)
      const resolved = typeof next === 'function' ? next(previous) : next
      yShared.set(key, resolved)
      setValue(resolved)
    },
    [key]
  )

  return [value, update]
}
