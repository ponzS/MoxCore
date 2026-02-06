import { exec as execCallback } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import { chromium } from 'playwright'

const filePurpose = 'run headless browser scrape and output page data'
const exec = promisify(execCallback)

const targetUrl = String(process.argv[2] || '').trim()
if (!targetUrl) {
  console.error('url 不能为空')
  process.exit(1)
}

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true })
  } catch {
    const browsersPath = await ensureBrowsersPath()
    await exec('npx playwright install chromium', {
      timeout: 300000,
      maxBuffer: 1024 * 1024,
      env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: browsersPath },
    })
    return chromium.launch({ headless: true })
  }
}

async function ensureBrowsersPath() {
  const baseDir = path.resolve(process.cwd(), 'extensions', 'browser', 'browsers')
  if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = baseDir
  }
  const targetDir = process.env.PLAYWRIGHT_BROWSERS_PATH
  await fs.mkdir(targetDir, { recursive: true })
  return targetDir
}

const browser = await launchBrowser()
const context = await browser.newContext()
const page = await context.newPage()
await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 25000 })

const data = await page.evaluate(() => {
  const title = String(document.title || '').trim()
  const text = String(document.body?.innerText || '').trim()
  const links = Array.from(document.querySelectorAll('a[href]'))
    .map(el => ({
      text: String(el.textContent || '').trim(),
      url: String(el.href || '').trim(),
    }))
    .filter(item => item.url)
  return { title, text, links }
})

const payload = {
  url: targetUrl,
  title: data.title,
  text: data.text,
  links: data.links,
}
const analysis = buildScrapeAnalysis(payload)
console.log(JSON.stringify({ ...payload, analysis }, null, 2))

await context.close()
// await browser.close()

function buildScrapeAnalysis(payload) {
  const linkDomains = new Map()
  for (const link of payload.links || []) {
    const domain = getDomain(link.url)
    if (!domain) continue
    linkDomains.set(domain, (linkDomains.get(domain) || 0) + 1)
  }
  const topDomains = Array.from(linkDomains.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([domain, count]) => ({ domain, count }))
  const insights = []
  insights.push(`正文长度：${payload.text?.length || 0}`)
  insights.push(`链接数量：${payload.links?.length || 0}`)
  if (topDomains.length) {
    insights.push(`链接来源集中：${topDomains.map(item => `${item.domain}(${item.count})`).join(', ')}`)
  }
  return { insights, topDomains }
}

function getDomain(raw) {
  try {
    return new URL(raw).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}
