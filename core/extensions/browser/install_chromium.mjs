import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'

const baseDir = path.resolve(process.cwd(), 'extensions', 'browser', 'browsers')
await fs.mkdir(baseDir, { recursive: true })
if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = baseDir
}

const mirrors = [
  { label: '默认下载源', env: { ...process.env } },
  { label: '镜像下载源', env: { ...process.env, PLAYWRIGHT_DOWNLOAD_HOST: 'https://playwright.azureedge.net' } },
]

let lastError = ''
for (const mirror of mirrors) {
  console.log(`开始安装 chromium (${mirror.label})`)
  try {
    await runCommand(['npx', 'playwright', 'install', 'chromium'], mirror.env)
    console.log('chromium 安装完成')
    process.exit(0)
  } catch (e) {
    lastError = String(e?.message || e || '安装失败')
    console.log(`安装失败：${lastError}`)
  }
}

console.log(`chromium 安装失败：${lastError}`)
process.exit(1)

async function runCommand(command, env) {
  const [cmd, ...args] = command
  const proc = spawn(cmd, args, { env, stdio: ['ignore', 'pipe', 'pipe'] })
  const handleLine = line => {
    const trimmed = String(line || '').trim()
    if (trimmed) console.log(trimmed)
  }
  proc.stdout.on('data', chunk => String(chunk).split(/\r?\n/).forEach(handleLine))
  proc.stderr.on('data', chunk => String(chunk).split(/\r?\n/).forEach(handleLine))
  const code = await new Promise((resolve, reject) => {
    proc.on('error', reject)
    proc.on('close', exitCode => resolve(exitCode ?? 0))
  })
  if (code !== 0) throw new Error(`安装进程退出码 ${code}`)
}
