const RAW_API_URL: string = (import.meta as any).env?.VITE_API_URL;
export const API_URL: string = RAW_API_URL.replace(/\/+$/, '')

type Json = Record<string, any>

async function request<T = any>(path: string, options: RequestInit & { json?: Json } = {}) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const url = `${API_URL}${normalizedPath}`
  const { json, headers, ...rest } = options
  const init: RequestInit = {
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
    ...rest,
    body: json ? JSON.stringify(json) : rest.body,
  }
  const res = await fetch(url, init)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || `Request failed (${res.status})`
    throw new Error(msg)
  }
  return data as T
}

export function signup(json: { username: string; email: string; password: string }) {
  return request('users/signup', { method: 'POST', json })
}

export function login(json: { email: string; password: string }) {
  return request('users/login', { method: 'POST', json })
}

export function createMeeting(json: { code: string; hostUserId: string; title?: string; description?: string }) {
  return request('meet/create', { method: 'POST', json })
}

export function endMeeting(json: { roomId: string }) {
  return request('meet/end', { method: 'POST', json })
}

export function getParticipants(roomId: string) {
  return request(`meet/${encodeURIComponent(roomId)}/`, { method: 'GET' })
}

export function joinMeeting(json: { roomId: string; userId: string; name?: string }) {
  return request('meet/join', { method: 'POST', json })
}

export function leaveMeeting(json: { roomId: string; userId: string }) {
  return request('meet/leave', { method: 'POST', json })
}
