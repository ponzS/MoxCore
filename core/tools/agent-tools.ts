import { promises as fs } from 'node:fs'
import path from 'node:path'
import { exec as execCallback } from 'node:child_process'
import { promisify } from 'node:util'
import { createBrowserTools } from './browser.js'

const exec = promisify(execCallback)

export type AgentToolContext = {
  workspaceRoot: string
  emit?: (message: string) => void
  registerCleanup?: (fn: () => Promise<void> | void) => void
}

export type AgentToolDefinition = {
  name: string
  description: string
  parameters: Record<string, unknown>
  execute: (args: Record<string, unknown>, context: AgentToolContext) => Promise<string>
}

function resolvePath(root: string, target: string) {
  const trimmed = String(target || '').trim()
  if (!trimmed) return path.resolve(root)
  if (path.isAbsolute(trimmed)) return path.resolve(trimmed)
  return path.resolve(root, trimmed)
}

function truncate(text: string, limit = 8000) {
  if (text.length <= limit) return text
  return `${text.slice(0, limit)}\n...[已截断]`
}

async function readFileTool(args: Record<string, unknown>, context: AgentToolContext) {
  const rawPath = String(args.path || '').trim()
  if (!rawPath) throw new Error('path 不能为空')
  const filePath = resolvePath(context.workspaceRoot, rawPath)
  const stat = await fs.stat(filePath)
  if (!stat.isFile()) throw new Error('目标不是文件')
  const content = await fs.readFile(filePath, 'utf8')
  return truncate(content, 20000)
}

async function writeFileTool(args: Record<string, unknown>, context: AgentToolContext) {
  const rawPath = String(args.path || '').trim()
  const content = String(args.content ?? '')
  if (!rawPath) throw new Error('path 不能为空')
  const filePath = resolvePath(context.workspaceRoot, rawPath)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, content, 'utf8')
  return 'ok'
}

async function listDirTool(args: Record<string, unknown>, context: AgentToolContext) {
  const rawPath = String(args.path || '').trim() || '.'
  const dirPath = resolvePath(context.workspaceRoot, rawPath)
  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  const payload = entries.map(entry => ({
    name: entry.name,
    type: entry.isDirectory() ? 'dir' : entry.isFile() ? 'file' : 'other',
  }))
  return JSON.stringify(payload, null, 2)
}

async function mkdirTool(args: Record<string, unknown>, context: AgentToolContext) {
  const rawPath = String(args.path || '').trim()
  if (!rawPath) throw new Error('path 不能为空')
  const dirPath = resolvePath(context.workspaceRoot, rawPath)
  await fs.mkdir(dirPath, { recursive: true })
  return 'ok'
}

async function execTool(args: Record<string, unknown>, context: AgentToolContext) {
  const command = String(args.command || '').trim()
  if (!command) throw new Error('command 不能为空')
  const cwdRaw = String(args.cwd || '').trim()
  const cwd = cwdRaw ? resolvePath(context.workspaceRoot, cwdRaw) : resolvePath(context.workspaceRoot, '.')
  const timeout = Number(args.timeoutMs || 20000)
  const { stdout, stderr } = await exec(command, {
    cwd,
    timeout: Number.isFinite(timeout) ? timeout : 20000,
    maxBuffer: 1024 * 1024,
    env: process.env,
  })
  return JSON.stringify(
    {
      stdout: truncate(stdout ?? '', 12000),
      stderr: truncate(stderr ?? '', 12000),
    },
    null,
    2
  )
}

export function createAgentTools(): AgentToolDefinition[] {
  return [
    {
      name: 'terminal_exec',
      description: '执行终端命令并返回 stdout/stderr',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string' },
          cwd: { type: 'string' },
          timeoutMs: { type: 'number' },
        },
        required: ['command'],
      },
      execute: execTool,
    },
    {
      name: 'fs_read',
      description: '读取文件内容',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
        },
        required: ['path'],
      },
      execute: readFileTool,
    },
    {
      name: 'fs_write',
      description: '写入文件（覆盖写入）',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['path', 'content'],
      },
      execute: writeFileTool,
    },
    {
      name: 'fs_list',
      description: '列出目录内容',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
        },
      },
      execute: listDirTool,
    },
    {
      name: 'fs_mkdir',
      description: '创建目录',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
        },
        required: ['path'],
      },
      execute: mkdirTool,
    },
    ...createBrowserTools(),
  ]
}
