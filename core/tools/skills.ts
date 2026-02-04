import { promises as fs } from 'node:fs'
import path from 'node:path'

export interface SkillInfo {
  name: string
  description?: string
  homepage?: string
  metadata?: unknown
  dir: string
}

type Frontmatter = Record<string, unknown>

function parseFrontmatter(raw: string): Frontmatter {
  const lines = raw.split('\n')
  if (lines[0]?.trim() !== '---') return {}
  const end = lines.findIndex((line, idx) => idx > 0 && line.trim() === '---')
  if (end < 0) return {}
  const meta: Frontmatter = {}
  for (const line of lines.slice(1, end)) {
    const match = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/)
    if (!match) continue
    const key = match[1]
    const valueRaw = match[2]?.trim() ?? ''
    if (!valueRaw) {
      meta[key] = ''
      continue
    }
    if ((valueRaw.startsWith('{') && valueRaw.endsWith('}')) || (valueRaw.startsWith('[') && valueRaw.endsWith(']'))) {
      try {
        meta[key] = JSON.parse(valueRaw)
        continue
      } catch {}
    }
    if ((valueRaw.startsWith('"') && valueRaw.endsWith('"')) || (valueRaw.startsWith("'") && valueRaw.endsWith("'"))) {
      meta[key] = valueRaw.slice(1, -1)
      continue
    }
    if (valueRaw === 'true') {
      meta[key] = true
      continue
    }
    if (valueRaw === 'false') {
      meta[key] = false
      continue
    }
    meta[key] = valueRaw
  }
  return meta
}

export async function listSkills(skillsRoot: string): Promise<SkillInfo[]> {
  const entries = await fs.readdir(skillsRoot, { withFileTypes: true }).catch(() => [])
  const results: SkillInfo[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const dir = path.join(skillsRoot, entry.name)
    const skillPath = path.join(dir, 'SKILL.md')
    const content = await fs.readFile(skillPath, 'utf8').catch(() => '')
    if (!content) continue
    const meta = parseFrontmatter(content)
    const name = String(meta.name || entry.name)
    const description = meta.description ? String(meta.description) : undefined
    const homepage = meta.homepage ? String(meta.homepage) : undefined
    results.push({
      name,
      description,
      homepage,
      metadata: meta.metadata,
      dir,
    })
  }
  return results.sort((a, b) => a.name.localeCompare(b.name))
}
