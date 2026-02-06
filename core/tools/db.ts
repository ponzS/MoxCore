import fs from 'node:fs'
import path from 'node:path'

type JsonStore = {
  getJson<T>(key: string, fallback: T): T
  setJson(key: string, value: unknown): void
}

const dataDir = path.resolve(process.cwd(), 'data')
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

const store: JsonStore = await (async () => {
  try {
    const { DatabaseSync } = await import('node:sqlite')
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
    return {
      getJson<T>(key: string, fallback: T): T {
        try {
          const row = db.prepare('SELECT value FROM kv WHERE key = ?').get(key) as { value?: string } | undefined
          if (!row?.value) return fallback
          return JSON.parse(row.value) as T
        } catch {
          return fallback
        }
      },
      setJson(key: string, value: unknown) {
        const payload = JSON.stringify(value ?? null)
        db.prepare('INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at').run(
          key,
          payload,
          Date.now()
        )
      }
    }
  } catch {
    const kvPath = path.join(dataDir, 'kv.json')
    let cache: Record<string, { value: string; updated_at: number }> = {}
    if (fs.existsSync(kvPath)) {
      try {
        cache = JSON.parse(fs.readFileSync(kvPath, 'utf-8')) as Record<string, { value: string; updated_at: number }>
      } catch {
        cache = {}
      }
    }
    const save = () => {
      fs.writeFileSync(kvPath, JSON.stringify(cache), 'utf-8')
    }
    return {
      getJson<T>(key: string, fallback: T): T {
        try {
          const row = cache[key]
          if (!row?.value) return fallback
          return JSON.parse(row.value) as T
        } catch {
          return fallback
        }
      },
      setJson(key: string, value: unknown) {
        cache[key] = {
          value: JSON.stringify(value ?? null),
          updated_at: Date.now()
        }
        save()
      }
    }
  }
})()

export function getJson<T>(key: string, fallback: T): T {
  return store.getJson(key, fallback)
}

export function setJson(key: string, value: unknown) {
  store.setJson(key, value)
}
