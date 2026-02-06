export type MusicCategory = {
  _id?: string
  name: string
  createdAt: number
  updatedAt?: number
}

export type MusicTrack = {
  _id?: string
  categoryId: string
  name: string
  path: string
  size?: number
  mime?: string
  createdAt: number
  updatedAt?: number
}

export type LocalUploadResult = {
  name: string
  path: string
  size?: number
  mime?: string
}

function nowId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function normalizeCategory(item: any): MusicCategory {
  if (!item) return item
  if (item._id) return item
  if (item.id) return { ...item, _id: item.id }
  return item
}

function normalizeTrack(item: any): MusicTrack {
  if (!item) return item
  if (item._id) return item
  if (item.id) return { ...item, _id: item.id }
  return item
}

const BASE_URL = `${window.origin}/api/music`

async function requestJson<T>(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    ...init,
  })
  if (!res.ok) {
    let extra = ''
    try {
      extra = await res.text()
    } catch {}
    throw new Error(`HTTP error! Status: ${res.status}${extra ? ` - ${extra}` : ''}`)
  }
  return (await res.json()) as T
}

async function requestForm<T>(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    credentials: 'include',
    ...init,
  })
  if (!res.ok) {
    let extra = ''
    try {
      extra = await res.text()
    } catch {}
    throw new Error(`HTTP error! Status: ${res.status}${extra ? ` - ${extra}` : ''}`)
  }
  return (await res.json()) as T
}

async function upsertDocs<T>(collection: string, docs: T | T[]) {
  const list = Array.isArray(docs) ? docs : [docs]
  const payload = collection === 'tracks' ? { items: list } : { name: (list[0] as any)?.name }
  const data = await requestJson<T | T[]>(`${BASE_URL}/${collection}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  if (Array.isArray(docs)) return data as T[]
  return data as T
}

async function removeDocs(collection: string, ids: string | string[]) {
  const list = Array.isArray(ids) ? ids : [ids]
  await Promise.all(list.map(id => requestJson(`${BASE_URL}/${collection}/${encodeURIComponent(id)}`, { method: 'DELETE' })))
}

export async function listCategories() {
  const rows = await requestJson<MusicCategory[]>(`${BASE_URL}/categories`, { method: 'GET' })
  return rows.map(normalizeCategory).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
}

export async function listTracks(categoryId: string) {
  const url = categoryId ? `${BASE_URL}/tracks?categoryId=${encodeURIComponent(categoryId)}` : `${BASE_URL}/tracks`
  const rows = await requestJson<MusicTrack[]>(url, { method: 'GET' })
  return rows.map(normalizeTrack).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
}

export async function createCategory(name: string) {
  const doc: MusicCategory = { _id: nowId(), name, createdAt: Date.now() }
  const created = (await upsertDocs('categories', doc)) as MusicCategory
  return normalizeCategory(created)
}

export async function renameCategory(id: string, name: string) {
  const doc: MusicCategory = { _id: id, name, createdAt: Date.now(), updatedAt: Date.now() }
  const updated = (await upsertDocs('categories', doc)) as MusicCategory
  return normalizeCategory(updated)
}

export async function removeCategoryAndTracks(categoryId: string) {
  const related = await listTracks(categoryId)
  const ids = related.map((item: MusicTrack) => item._id).filter(Boolean) as string[]
  if (ids.length) await removeDocs('tracks', ids)
  await removeDocs('categories', categoryId)
}

export async function upsertTracks(items: MusicTrack[]) {
  if (!items.length) return []
  const updated = (await upsertDocs('tracks', items)) as MusicTrack[]
  return updated.map(normalizeTrack)
}

export async function removeTrackById(id: string) {
  await removeDocs('tracks', id)
}

export async function uploadLocalFiles(files: File[]) {
  if (!files.length) return [] as LocalUploadResult[]
  const form = new FormData()
  for (const file of files) {
    form.append('files', file)
  }
  return await requestForm<LocalUploadResult[]>(`${BASE_URL}/upload`, {
    method: 'POST',
    body: form,
  })
}
