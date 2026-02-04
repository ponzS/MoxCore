import { exec as execCallback, spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import { chromium, type Browser, type Page } from 'playwright'
import type { AgentToolContext, AgentToolDefinition } from './agent-tools.js'

const filePurpose = 'headless browser helpers for agent tools'

let browserPromise: Promise<Browser> | null = null
let systemBrowserPromise: Promise<Browser> | null = null
const exec = promisify(execCallback)

const defaultEngines = ['baidu', 'google', 'bing'] as const
type SearchEngine = (typeof defaultEngines)[number]
type BrowserOptions = {
  useSystemBrowser?: boolean
  cdpUrl?: string
  debugPort?: number
  systemBrowserPath?: string
}

function ensureHttpUrl(raw: string) {
  const cleaned = String(raw || '').trim().replace(/^[`'"\\s]+|[`'"\\s]+$/g, '')
  const url = new URL(cleaned)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('仅支持 http/https 地址')
  }
  return url.toString()
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.floor(value)))
}

function truncate(text: string, limit: number) {
  if (text.length <= limit) return text
  return `${text.slice(0, limit)}\n...[已截断]`
}

async function getBrowser(options?: BrowserOptions, context?: AgentToolContext) {
  if (systemBrowserPromise) return systemBrowserPromise
  if (options?.useSystemBrowser || options?.cdpUrl || options?.systemBrowserPath || options?.debugPort) {
    systemBrowserPromise = connectSystemBrowser(options, context)
    return systemBrowserPromise
  }
  if (!browserPromise) {
    browserPromise = launchBrowser(context)
  }
  return browserPromise
}

async function launchBrowser(context?: AgentToolContext) {
  const browsersPath = await ensureBrowsersPath(context)
  const hasLocal = await hasChromiumInstall(browsersPath)
  if (hasLocal) {
    context?.emit?.(`检测到本地浏览器资源：${browsersPath}`)
  }
  try {
    context?.emit?.('启动无头浏览器')
    return await chromium.launch({ headless: true })
  } catch {
    context?.emit?.('浏览器环境缺失，准备安装 chromium')
    await installBrowser(browsersPath, context)
    return chromium.launch({ headless: true })
  }
}

async function ensureBrowsersPath(context?: AgentToolContext) {
  const baseDir = path.resolve(process.cwd(), 'extensions', 'browser', 'browsers')
  if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = baseDir
  }
  const targetDir = process.env.PLAYWRIGHT_BROWSERS_PATH
  await fs.mkdir(targetDir, { recursive: true })
  context?.emit?.(`浏览器资源目录：${targetDir}`)
  return targetDir
}

async function hasChromiumInstall(browsersPath: string) {
  const entries = await fs.readdir(browsersPath).catch(() => [])
  return entries.some(name => name.startsWith('chromium-') || name.startsWith('chromium'))
}

async function installBrowser(browsersPath: string, context?: AgentToolContext) {
  const attempts = [
    { label: '默认下载源', env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: browsersPath } },
    {
      label: '镜像下载源',
      env: {
        ...process.env,
        PLAYWRIGHT_BROWSERS_PATH: browsersPath,
        PLAYWRIGHT_DOWNLOAD_HOST: 'https://playwright.azureedge.net',
      },
    },
  ]
  let lastError = ''
  for (const attempt of attempts) {
    context?.emit?.(`开始安装 chromium (${attempt.label})`)
    try {
      await runCommandWithProgress(['npx', 'playwright', 'install', 'chromium'], {
        env: attempt.env,
        timeoutMs: 300000,
        onLine: line => context?.emit?.(line),
      })
      context?.emit?.('chromium 安装完成')
      return
    } catch (e: any) {
      lastError = String(e?.message || e || '安装失败')
      context?.emit?.(`安装失败：${lastError}`)
    }
  }
  throw new Error(
    `chromium 安装失败：${lastError}\n可能原因：网络超时或下载源不可达\n已尝试：默认源与镜像源\n建议：检查网络/代理后重试，或手动执行 npx playwright install chromium`
  )
}

async function runCommandWithProgress(
  command: string[],
  options: {
    env: NodeJS.ProcessEnv
    timeoutMs: number
    onLine?: (line: string) => void
  }
) {
  const [cmd, ...args] = command
  const proc = spawn(cmd, args, {
    env: options.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const timer = setTimeout(() => {
    proc.kill('SIGKILL')
  }, options.timeoutMs)
  const handleLine = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed) return
    options.onLine?.(trimmed)
  }
  proc.stdout.on('data', chunk => {
    String(chunk)
      .split(/\r?\n/)
      .forEach(handleLine)
  })
  proc.stderr.on('data', chunk => {
    String(chunk)
      .split(/\r?\n/)
      .forEach(handleLine)
  })
  const exitCode: number = await new Promise((resolve, reject) => {
    proc.on('error', reject)
    proc.on('close', code => resolve(code ?? 0))
  })
  clearTimeout(timer)
  if (exitCode !== 0) {
    throw new Error(`安装进程退出码 ${exitCode}`)
  }
}

async function withPage<T>(
  fn: (page: Page) => Promise<T>,
  options?: BrowserOptions,
  context?: AgentToolContext
) {
  const browser = await getBrowser(options, context)
  const useSystem = Boolean(
    systemBrowserPromise || options?.useSystemBrowser || options?.cdpUrl || options?.systemBrowserPath || options?.debugPort
  )
  let deferClose = false
  const contextInstance = useSystem ? browser.contexts()[0] ?? (await browser.newContext()) : await browser.newContext()
  const page = await contextInstance.newPage()
  try {
    return await fn(page)
  } finally {
    if (context?.registerCleanup) {
      context.registerCleanup(async () => {
        if (useSystem) {
          await page.close().catch(() => {})
        } else {
          await contextInstance.close().catch(() => {})
        }
      })
      deferClose = true
    }
    if (!deferClose) {
      if (useSystem) {
        await page.close().catch(() => {})
      } else {
        await contextInstance.close()
      }
    }
  }
}

async function browserSearchTool(args: Record<string, unknown>, context?: AgentToolContext) {
  const query = String(args.query || '').trim()
  if (!query) throw new Error('query 不能为空')
  const limit = clampNumber(Number(args.limit || 5), 1, 20)
  const engines = normalizeEngines(args.engines)
  const options = parseBrowserOptions(args)
  const resultsByEngine: Record<string, Array<{ title: string; url: string; snippet: string }>> = {}
  const merged: Array<{ engine: string; title: string; url: string; snippet: string }> = []
  const steps: string[] = []

  const step = (message: string) => {
    if (!message) return
    steps.push(message)
    context?.emit?.(message)
  }

  step(`搜索关键词：${query}`)
  step(`搜索引擎：${engines.join(', ')}`)

  for (const engine of engines) {
    step(`开始搜索：${engine}`)
    const results = await searchWithEngine(engine, query, limit, options, context)
    resultsByEngine[engine] = results
    for (const item of results) {
      merged.push({ engine, ...item })
    }
    step(`完成搜索：${engine}（${results.length} 条）`)
  }

  const summary = summarizeResults(merged)
  const analysis = buildSearchAnalysis(summary, engines)
  return JSON.stringify(
    {
      query,
      engines,
      steps,
      resultsByEngine,
      results: merged,
      summary,
      analysis,
    },
    null,
    2
  )
}

async function browserScrapeTool(args: Record<string, unknown>, context?: AgentToolContext) {
  const targetUrl = String(args.url || '').trim()
  if (!targetUrl) throw new Error('url 不能为空')
  const url = ensureHttpUrl(targetUrl)
  const linkLimit = clampNumber(Number(args.linkLimit || 20), 0, 100)
  const textLimit = clampNumber(Number(args.textLimit || 20000), 1000, 80000)
  const options = parseBrowserOptions(args)
  const steps: string[] = []
  const step = (message: string) => {
    if (!message) return
    steps.push(message)
    context?.emit?.(message)
  }
  step(`访问页面：${url}`)
  step('开始提取正文与链接')
  const payload = await withPage(async page => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 })
    await page.waitForLoadState('domcontentloaded').catch(() => {})
    await page.waitForLoadState('load').catch(() => {})
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
    step(`页面加载完成：${page.url()}`)
    const data = (await safeEvaluate(page, (maxLinks: number) => {
      const title = String(document.title || '').trim()
      const text = String(document.body?.innerText || '').trim()
      const links = Array.from(document.querySelectorAll('a[href]'))
        .map(el => ({
          text: String(el.textContent || '').trim(),
          url: String((el as HTMLAnchorElement).href || '').trim(),
        }))
        .filter(item => item.url)
        .slice(0, maxLinks)
      return { title, text, links }
    }, linkLimit)) as { title: string; text: string; links: Array<{ text: string; url: string }> }
    return {
      url,
      title: data.title,
      text: truncate(data.text, textLimit),
      links: data.links,
    }
  }, options, context)
  const analysis = buildScrapeAnalysis(payload)
  return JSON.stringify({ ...payload, steps, analysis }, null, 2)
}

async function safeEvaluate(page: Page, fn: any, arg: any) {
  try {
    return await page.evaluate(fn, arg)
  } catch (e: any) {
    const message = String(e?.message || e || '')
    if (message.includes('Execution context was destroyed') || message.includes('navigation')) {
      await page.waitForLoadState('domcontentloaded').catch(() => {})
      await page.waitForTimeout(500).catch(() => {})
      return await page.evaluate(fn, arg)
    }
    throw e
  }
}

function normalizeEngines(raw: unknown): SearchEngine[] {
  if (Array.isArray(raw)) {
    const set = new Set(
      raw
        .map(item => String(item || '').trim().toLowerCase())
        .filter(item => defaultEngines.includes(item as SearchEngine))
    )
    return set.size ? (Array.from(set) as SearchEngine[]) : ([...defaultEngines] as SearchEngine[])
  }
  if (typeof raw === 'string') {
    const parts = raw
      .split(',')
      .map(item => item.trim().toLowerCase())
      .filter(Boolean)
    const set = new Set(parts.filter(item => defaultEngines.includes(item as SearchEngine)))
    return set.size ? (Array.from(set) as SearchEngine[]) : ([...defaultEngines] as SearchEngine[])
  }
  return [...defaultEngines] as SearchEngine[]
}

async function searchWithEngine(
  engine: SearchEngine,
  query: string,
  limit: number,
  options?: BrowserOptions,
  context?: AgentToolContext
) {
  const url = buildSearchUrl(engine, query)
  return await withPage(async page => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 })
    await waitForEngineSelector(page, engine)
    const results = await page.evaluate(
      ({ engineName, maxItems }: { engineName: string; maxItems: number }) => {
        const list: Array<{ title: string; url: string; snippet: string }> = []
        if (engineName === 'bing') {
          const items = Array.from(document.querySelectorAll('li.b_algo'))
          for (const item of items) {
            const link = item.querySelector<HTMLAnchorElement>('h2 a')
            if (!link) continue
            const title = String(link.textContent || '').trim()
            const url = String(link.href || '').trim()
            const snippet = String(item.querySelector('p')?.textContent || '').trim()
            if (!title || !url) continue
            list.push({ title, url, snippet })
            if (list.length >= maxItems) break
          }
          return list
        }
        if (engineName === 'google') {
          const items = Array.from(document.querySelectorAll('div#search .g'))
          for (const item of items) {
            const titleEl = item.querySelector('h3')
            const link = item.querySelector<HTMLAnchorElement>('a')
            if (!titleEl || !link) continue
            const title = String(titleEl.textContent || '').trim()
            const url = String(link.href || '').trim()
            const snippet = String(
              item.querySelector('.VwiC3b')?.textContent ||
                item.querySelector('.aCOpRe')?.textContent ||
                ''
            ).trim()
            if (!title || !url) continue
            list.push({ title, url, snippet })
            if (list.length >= maxItems) break
          }
          return list
        }
        const items = Array.from(document.querySelectorAll('#content_left .result, #content_left .result-op'))
        for (const item of items) {
          const link = item.querySelector<HTMLAnchorElement>('h3 a')
          if (!link) continue
          const title = String(link.textContent || '').trim()
          const url = String(link.href || '').trim()
          const snippet = String(
            item.querySelector('.c-abstract')?.textContent ||
              item.querySelector('.c-span-last')?.textContent ||
              item.querySelector('.content-right_8Zs40')?.textContent ||
              ''
          ).trim()
          if (!title || !url) continue
          list.push({ title, url, snippet })
          if (list.length >= maxItems) break
        }
        return list
      },
      { engineName: engine, maxItems: limit }
    )
    return results
  }, options, context)
}

function parseBrowserOptions(args: Record<string, unknown>): BrowserOptions {
  const useSystemBrowser = args.useSystemBrowser === false ? false : true
  const cdpUrl = String(args.cdpUrl || '').trim() || undefined
  const debugPort = Number.isFinite(Number(args.debugPort)) ? Number(args.debugPort) : undefined
  const systemBrowserPath = String(args.systemBrowserPath || '').trim() || getDefaultSystemBrowserPath()
  return {
    useSystemBrowser,
    cdpUrl,
    debugPort,
    systemBrowserPath,
  }
}

async function connectSystemBrowser(options: BrowserOptions | undefined, context?: AgentToolContext) {
  const cdpUrl = options?.cdpUrl
  if (cdpUrl) {
    context?.emit?.(`连接现有浏览器：${cdpUrl}`)
    return await connectOverCDP(cdpUrl)
  }
  const preferredPath = options?.systemBrowserPath
  if (preferredPath) {
    const ok = await fs.stat(preferredPath).then(stat => stat.isFile()).catch(() => false)
    if (ok) {
      const port = options?.debugPort || 9222
      const profileDir = path.resolve(process.cwd(), 'extensions', 'browser', 'system-profile')
      await fs.mkdir(profileDir, { recursive: true })
      context?.emit?.(`优先启动系统浏览器：${preferredPath}`)
      spawn(
        preferredPath,
        [
          `--remote-debugging-port=${port}`,
          `--user-data-dir=${profileDir}`,
          '--no-first-run',
          '--no-default-browser-check',
        ],
        { detached: true, stdio: 'ignore' }
      ).unref()
      const url = `http://127.0.0.1:${port}`
      context?.emit?.(`等待浏览器调试端口：${url}`)
      return await waitForCDP(url, 15000)
    }
    context?.emit?.(`指定浏览器路径不可用：${preferredPath}`)
  }
  const ports = [options?.debugPort, 9222, 9223, 9224].filter(Boolean) as number[]
  for (const port of ports) {
    const url = `http://127.0.0.1:${port}`
    try {
      context?.emit?.(`尝试连接本地浏览器：${url}`)
      return await connectOverCDP(url)
    } catch (e: any) {
      context?.emit?.(`连接失败：${String(e?.message || e || '未知错误')}`)
    }
  }
  const executable = await findSystemBrowserExecutable()
  if (!executable) {
    throw new Error('未找到可用的系统浏览器执行文件')
  }
  const port = options?.debugPort || 9222
  const profileDir = path.resolve(process.cwd(), 'extensions', 'browser', 'system-profile')
  await fs.mkdir(profileDir, { recursive: true })
  context?.emit?.(`启动系统浏览器：${executable}`)
  spawn(executable, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
  ], { detached: true, stdio: 'ignore' }).unref()
  const url = `http://127.0.0.1:${port}`
  context?.emit?.(`等待浏览器调试端口：${url}`)
  return await waitForCDP(url, 15000)
}

async function connectOverCDP(url: string) {
  return await chromium.connectOverCDP(url, { timeout: 5000 })
}

async function waitForCDP(url: string, timeoutMs: number) {
  const start = Date.now()
  let lastError = ''
  while (Date.now() - start < timeoutMs) {
    try {
      return await connectOverCDP(url)
    } catch (e: any) {
      lastError = String(e?.message || e || '连接失败')
      await new Promise(resolve => setTimeout(resolve, 800))
    }
  }
  throw new Error(`连接浏览器超时：${lastError}`)
}

async function findSystemBrowserExecutable() {
  const candidates: string[] = []
  if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    )
  } else if (process.platform === 'win32') {
    const programFiles = process.env.PROGRAMFILES || 'C:\\Program Files'
    const programFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)'
    candidates.push(
      `${programFiles}\\Google\\Chrome\\Application\\chrome.exe`,
      `${programFilesX86}\\Google\\Chrome\\Application\\chrome.exe`,
      `${programFiles}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`,
      `${programFiles}\\Microsoft\\Edge\\Application\\msedge.exe`
    )
  } else {
    candidates.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/brave-browser',
      '/usr/bin/microsoft-edge'
    )
  }
  for (const candidate of candidates) {
    const exists = await fs.stat(candidate).then(stat => stat.isFile()).catch(() => false)
    if (exists) return candidate
  }
  return ''
}

function getDefaultSystemBrowserPath() {
  if (process.platform === 'darwin') {
    return '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'
  }
  return ''
}

function summarizeResults(results: Array<{ engine: string; title: string; url: string; snippet: string }>) {
  const domainCount = new Map<string, number>()
  const engineCount = new Map<string, number>()
  for (const item of results) {
    const domain = getDomain(item.url)
    if (domain) domainCount.set(domain, (domainCount.get(domain) || 0) + 1)
    engineCount.set(item.engine, (engineCount.get(item.engine) || 0) + 1)
  }
  const topDomains = Array.from(domainCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([domain, count]) => ({ domain, count }))
  const byEngine = Array.from(engineCount.entries()).map(([engine, count]) => ({ engine, count }))
  return {
    total: results.length,
    byEngine,
    topDomains,
  }
}

function buildSearchAnalysis(
  summary: { total: number; byEngine: Array<{ engine: string; count: number }>; topDomains: Array<{ domain: string; count: number }> },
  engines: SearchEngine[]
) {
  const insights: string[] = []
  if (!summary.total) {
    insights.push('未获取到有效结果，建议检查关键词或更换搜索引擎')
  }
  if (summary.topDomains.length) {
    const top = summary.topDomains.map(item => `${item.domain}(${item.count})`).join(', ')
    insights.push(`高频来源：${top}`)
  }
  const engineInfo = summary.byEngine.map(item => `${item.engine}:${item.count}`).join('，')
  if (engineInfo) insights.push(`各引擎命中：${engineInfo}`)
  const nextActions = ['选择目标链接，使用 browser_scrape 获取正文与资源']
  return {
    engines,
    insights,
    nextActions,
  }
}

function buildScrapeAnalysis(payload: { url: string; title: string; text: string; links: Array<{ text: string; url: string }> }) {
  const linkDomains = new Map<string, number>()
  for (const link of payload.links || []) {
    const domain = getDomain(link.url)
    if (!domain) continue
    linkDomains.set(domain, (linkDomains.get(domain) || 0) + 1)
  }
  const topDomains = Array.from(linkDomains.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([domain, count]) => ({ domain, count }))
  const insights: string[] = []
  insights.push(`正文长度：${payload.text?.length || 0}`)
  insights.push(`链接数量：${payload.links?.length || 0}`)
  if (topDomains.length) {
    insights.push(`链接来源集中：${topDomains.map(item => `${item.domain}(${item.count})`).join(', ')}`)
  }
  return {
    insights,
    topDomains,
  }
}

function getDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

async function waitForEngineSelector(page: Page, engine: SearchEngine) {
  const selectorMap: Record<SearchEngine, string> = {
    baidu: '#content_left',
    google: 'div#search',
    bing: 'li.b_algo',
  }
  const selector = selectorMap[engine]
  await page.waitForSelector(selector, { timeout: 8000 }).catch(() => {})
}

function buildSearchUrl(engine: SearchEngine, query: string) {
  if (engine === 'bing') {
    return `https://www.bing.com/search?q=${encodeURIComponent(query)}`
  }
  if (engine === 'google') {
    return `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=zh-CN`
  }
  return `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`
}

export function createBrowserTools(): AgentToolDefinition[] {
  return [
    {
      name: 'browser_search',
      description: '使用无头浏览器搜索网页并返回标题/链接/摘要',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          limit: { type: 'number' },
          engines: {
            anyOf: [
              {
                type: 'array',
                items: { type: 'string' },
              },
              {
                type: 'string',
              },
            ],
          },
          useSystemBrowser: { type: 'boolean' },
          cdpUrl: { type: 'string' },
          debugPort: { type: 'number' },
          systemBrowserPath: { type: 'string' },
        },
        required: ['query'],
      },
      execute: async (args, context) => browserSearchTool(args, context),
    },
    {
      name: 'browser_scrape',
      description: '使用无头浏览器访问页面并提取正文与链接',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          linkLimit: { type: 'number' },
          textLimit: { type: 'number' },
          useSystemBrowser: { type: 'boolean' },
          cdpUrl: { type: 'string' },
          debugPort: { type: 'number' },
          systemBrowserPath: { type: 'string' },
        },
        required: ['url'],
      },
      execute: async (args, context) => browserScrapeTool(args, context),
    },
  ]
}
