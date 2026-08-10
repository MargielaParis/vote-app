import { LIMITS, POLL_ID_RE } from '@shared/limits.js'
import { POLL_TYPES } from '@shared/enums.js'

const STORAGE_KEY = 'vote-app:v1:poll-history'
const MIGRATION_KEY = 'vote-app:v1:poll-history-migrated'
const HIDDEN_KEY = 'vote-app:v1:poll-history-hidden'
const VOTER_PREFIX = 'vote-app:v1:voter:'
const ADMIN_PREFIX = 'vote-app:v1:admin:'
const CHANGE_EVENT = 'vote-app:poll-history-change'
const MAX_ENTRIES = 100
const ROLES = new Set(['creator', 'voter', 'visited'])

let memory = []

function safeTime(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null
}

function cleanEntry(value) {
  if (!value || !POLL_ID_RE.test(value.id)) return null
  const roles = Array.isArray(value.roles) ? value.roles.filter((role) => ROLES.has(role)) : []
  if (!roles.includes('visited')) roles.push('visited')

  return {
    id: value.id,
    title: typeof value.title === 'string' ? value.title.trim().slice(0, LIMITS.TITLE_MAX) : '',
    pollType: POLL_TYPES.includes(value.pollType) ? value.pollType : null,
    deadline: safeTime(value.deadline),
    createdAt: safeTime(value.createdAt),
    votedAt: safeTime(value.votedAt),
    lastOpenedAt: safeTime(value.lastOpenedAt) || 0,
    unavailable: value.unavailable === true,
    roles: [...new Set(roles)],
  }
}

function sortEntries(entries) {
  return entries
    .map(cleanEntry)
    .filter(Boolean)
    .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)
    .slice(0, MAX_ENTRIES)
}

function loadEntries() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    const entries = Array.isArray(stored?.entries) ? sortEntries(stored.entries) : []
    memory = entries
    return entries
  } catch {
    return memory
  }
}

function saveEntries(entries) {
  const next = sortEntries(entries)
  memory = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, entries: next }))
  } catch {
    /* 메모리만 */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
  return next
}

function loadHiddenIds() {
  try {
    const stored = JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]')
    return new Set(Array.isArray(stored) ? stored.filter((id) => POLL_ID_RE.test(id)) : [])
  } catch {
    return new Set()
  }
}

function saveHiddenIds(ids) {
  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify([...ids].slice(-MAX_ENTRIES)))
  } catch {
    /* 무시 */
  }
}

function roleSet(entry) {
  return new Set(entry?.roles || ['visited'])
}

export function getPollHistory() {
  return loadEntries()
}

export function rememberPoll(poll, { creator = false, voter = false, touch = true } = {}) {
  if (!poll || !POLL_ID_RE.test(poll.id)) return getPollHistory()

  const hidden = loadHiddenIds()
  if (hidden.delete(poll.id)) saveHiddenIds(hidden)
  const entries = loadEntries()
  const current = entries.find((entry) => entry.id === poll.id)
  const roles = roleSet(current)
  roles.add('visited')
  if (creator) roles.add('creator')
  if (voter) roles.add('voter')

  const now = Date.now()
  const next = {
    id: poll.id,
    title:
      typeof poll.title === 'string' && poll.title.trim()
        ? poll.title.trim()
        : current?.title || '',
    pollType: POLL_TYPES.includes(poll.pollType) ? poll.pollType : current?.pollType || null,
    deadline: safeTime(poll.deadline) ?? current?.deadline ?? null,
    createdAt: safeTime(poll.createdAt) ?? current?.createdAt ?? null,
    votedAt: voter ? current?.votedAt || now : current?.votedAt || null,
    lastOpenedAt: touch ? now : current?.lastOpenedAt || 0,
    unavailable: false,
    roles: [...roles],
  }

  return saveEntries([next, ...entries.filter((entry) => entry.id !== poll.id)])
}

export function markPollUnavailable(id) {
  if (!POLL_ID_RE.test(id)) return getPollHistory()
  return saveEntries(
    loadEntries().map((entry) => (entry.id === id ? { ...entry, unavailable: true } : entry)),
  )
}

export function removePollRole(id, role) {
  if (!POLL_ID_RE.test(id) || !ROLES.has(role) || role === 'visited') return getPollHistory()
  const entries = loadEntries()
  return saveEntries(
    entries.map((entry) => {
      if (entry.id !== id) return entry
      const roles = roleSet(entry)
      roles.delete(role)
      roles.add('visited')
      return { ...entry, roles: [...roles] }
    }),
  )
}

export function forgetPoll(id) {
  if (!POLL_ID_RE.test(id)) return getPollHistory()
  const hidden = loadHiddenIds()
  hidden.add(id)
  saveHiddenIds(hidden)
  return saveEntries(loadEntries().filter((entry) => entry.id !== id))
}

export function clearPollHistory() {
  const hidden = loadHiddenIds()
  loadEntries().forEach((entry) => hidden.add(entry.id))
  saveHiddenIds(hidden)
  try {
    localStorage.setItem(MIGRATION_KEY, '1')
  } catch {
    /* 무시 */
  }
  return saveEntries([])
}

export function migrateLegacyPollHistory() {
  try {
    if (localStorage.getItem(MIGRATION_KEY) === '1') return getPollHistory()

    const entries = new Map(loadEntries().map((entry) => [entry.id, entry]))
    const hidden = loadHiddenIds()
    for (let index = 0; index < localStorage.length; index += 1) {
      const name = localStorage.key(index)
      if (!name?.startsWith(VOTER_PREFIX)) continue
      const id = name.slice(VOTER_PREFIX.length)
      if (!POLL_ID_RE.test(id) || hidden.has(id) || entries.has(id)) continue
      entries.set(id, cleanEntry({ id, roles: ['visited'] }))
    }
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const name = sessionStorage.key(index)
      if (!name?.startsWith(ADMIN_PREFIX)) continue
      const id = name.slice(ADMIN_PREFIX.length)
      if (!POLL_ID_RE.test(id) || hidden.has(id)) continue
      const current = entries.get(id)
      const roles = roleSet(current)
      roles.add('creator')
      entries.set(id, cleanEntry({ ...current, id, roles: [...roles] }))
    }

    localStorage.setItem(MIGRATION_KEY, '1')
    return saveEntries([...entries.values()])
  } catch {
    return getPollHistory()
  }
}

export function subscribePollHistory(listener) {
  const onStorage = (event) => {
    if (event.key === STORAGE_KEY) listener()
  }
  window.addEventListener(CHANGE_EVENT, listener)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener)
    window.removeEventListener('storage', onStorage)
  }
}
