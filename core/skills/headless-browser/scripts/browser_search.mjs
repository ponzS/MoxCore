import { exec as execCallback } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import { chromium } from 'playwright'

const filePurpose = 'run headless browser search and output results'
const exec = promisify(execCallback)

const query = process.argv.slice(2).join(' ').trim()
if (!query) {
  console.error('query 不能为空')
  process.exit(1)
}

const limit = 6
const engines = ['baidu', 'google', 'bing']
const steps = []

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

async function searchEngine(browser, engine, keyword, maxItems) {
  const context = await browser.newContext()
  const page = await context.newPage()
  const url =
    engine === 'bing'
      ? `https://www.bing.com/search?q=${encodeURIComponent(keyword)}`
      : engine === 'google'
        ? `https://www.google.com/search?q=${encodeURIComponent(keyword)}&hl=zh-CN`
        : `https://www.baidu.com/s?wd=${encodeURIComponent(keyword)}`
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 })
  const selector = engine === 'bing' ? 'li.b_algo' : engine === 'google' ? 'div#search' : '#content_left'
  await page.waitForSelector(selector, { timeout: 8000 }).catch(() => {})
  const results = await page.evaluate(
    ({ engineName, limitValue }) => {
      const list = []
      if (engineName === 'bing') {
        const items = Array.from(document.querySelectorAll('li.b_algo'))
        for (const item of items) {
          const link = item.querySelector('h2 a')
          if (!link) continue
          const title = String(link.textContent || '').trim()
          const url = String(link.href || '').trim()
          const snippet = String(item.querySelector('p')?.textContent || '').trim()
          if (!title || !url) continue
          list.push({ title, url, snippet })
          if (list.length >= limitValue) break
        }
        return list
      }
      if (engineName === 'google') {
        const items = Array.from(document.querySelectorAll('div#search .g'))
        for (const item of items) {
          const titleEl = item.querySelector('h3')
          const link = item.querySelector('a')
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
          if (list.length >= limitValue) break
        }
        return list
      }
      const items = Array.from(document.querySelectorAll('#content_left .result, #content_left .result-op'))
      for (const item of items) {
        const link = item.querySelector('h3 a')
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
        if (list.length >= limitValue) break
      }
      return list
    },
    { engineName: engine, limitValue: maxItems }
  )
  await context.close()
  return results
}

steps.push(`搜索关键词：${query}`)
steps.push(`搜索引擎：${engines.join(', ')}`)

const browser = await launchBrowser()
const resultsByEngine = {}
const merged = []
for (const engine of engines) {
  steps.push(`开始搜索：${engine}`)
  const items = await searchEngine(browser, engine, query, limit)
  resultsByEngine[engine] = items
  for (const item of items) {
    merged.push({ engine, ...item })
  }
  steps.push(`完成搜索：${engine}（${items.length} 条）`)
}

const summary = summarizeResults(merged)
const analysis = buildSearchAnalysis(summary, engines)
console.log(JSON.stringify({ query, engines, steps, resultsByEngine, results: merged, summary, analysis }, null, 2))
//await browser.close()

function summarizeResults(results) {
  const domainCount = new Map()
  const engineCount = new Map()
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
  return { total: results.length, byEngine, topDomains }
}

function buildSearchAnalysis(summary, engineList) {
  const insights = []
  if (!summary.total) {
    insights.push('未获取到有效结果，建议检查关键词或更换搜索引擎')
  }
  if (summary.topDomains.length) {
    insights.push(`高频来源：${summary.topDomains.map(item => `${item.domain}(${item.count})`).join(', ')}`)
  }
  const engineInfo = summary.byEngine.map(item => `${item.engine}:${item.count}`).join('，')
  if (engineInfo) insights.push(`各引擎命中：${engineInfo}`)
  return {
    engines: engineList,
    insights,
    nextActions: ['选择目标链接，使用 browser_scrape 获取正文与资源'],
  }
}

function getDomain(raw) {
  try {
    return new URL(raw).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}
