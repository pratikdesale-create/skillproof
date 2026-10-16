// Lightweight typed fetch client for Placement Hub APIs.

export class ApiError extends Error {
  status: number
  data?: unknown
  constructor(status: number, message: string, data?: unknown) {
    super(message)
    this.status = status
    this.data = data
  }
}

async function parseError(res: Response): Promise<ApiError> {
  let msg = `Request failed (${res.status})`
  let data: unknown
  try {
    data = await res.json()
    if (data && typeof data === 'object' && 'error' in data) {
      msg = String((data as Record<string, unknown>).error)
    }
  } catch {
    // not json
  }
  return new ApiError(res.status, msg, data)
}

export async function api<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers as Record<string, string> | undefined),
  }
  const res = await fetch(url, { ...options, headers, credentials: 'same-origin' })
  if (!res.ok) throw await parseError(res)
  if (res.status === 204) return undefined as unknown as T
  const ct = res.headers.get('content-type') ?? ''
  if (!ct.includes('application/json')) {
    return (await res.text()) as unknown as T
  }
  return (await res.json()) as T
}

// Helpers for common verbs
export const apiGet = <T = unknown>(url: string, init: RequestInit = {}) => api<T>(url, { ...init, method: 'GET' })
export const apiPost = <T = unknown>(url: string, body?: unknown, init: RequestInit = {}) =>
  api<T>(url, { ...init, method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined })
export const apiPatch = <T = unknown>(url: string, body?: unknown, init: RequestInit = {}) =>
  api<T>(url, { ...init, method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined })
export const apiDelete = <T = unknown>(url: string, init: RequestInit = {}) => api<T>(url, { ...init, method: 'DELETE' })
