import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const dataDir = path.resolve(process.cwd(), 'data')
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

const dbPath = path.join(dataDir, 'lzc-bot.sqlite')
const db = new DatabaseSync(dbPath)
db.exec('PRAGMA journal_mode = WAL')
db.exec(`
  CREATE TABLE IF NOT EXISTS kv (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )
`)

export function getJson<T>(key: string, fallback: T): T {
  try {
    const row = db.prepare('SELECT value FROM kv WHERE key = ?').get(key) as { value?: string } | undefined
    if (!row?.value) return fallback
    return JSON.parse(row.value) as T
  } catch {
    return fallback
  }
}

export function setJson(key: string, value: unknown) {
  const payload = JSON.stringify(value ?? null)
  db.prepare('INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at').run(
    key,
    payload,
    Date.now()
  )
}
