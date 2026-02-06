---
name: headless-browser
description: 使用无头浏览器进行网页搜索与页面抓取。用于需要自动化渲染或批量采集，且不依赖系统浏览器会话的任务。
---

# Headless Browser

## 能力概览

- 通过 `browser_search` 搜索网页并输出结构化结果
- 通过 `browser_scrape` 抓取页面正文与链接
- 自动安装/复用 Chromium 资源到 extensions/browser/browsers
- 需要脚本时，使用 `scripts/` 下的可执行脚本

## 适用场景

- 需要稳定、无界面的自动化搜索/抓取
- 不依赖登录态、扩展或系统浏览器配置
- 适合批量任务或后台环境执行

## 推荐流程

1. 先用 `browser_search` 获取候选结果
2. 选择目标链接，使用 `browser_scrape` 获取正文与资源链接
3. 需要批量任务时，使用脚本执行并汇总输出

## 工具用法

### browser_search

参数：
- query: 搜索关键词
- limit: 返回条数（可选）
- engines: 搜索引擎列表（可选，支持 baidu, google, bing）
- useSystemBrowser: 设为 false 强制无头浏览器
- cdpUrl/debugPort/systemBrowserPath: 不使用

### browser_scrape

参数：
- url: 目标地址
- linkLimit: 返回链接数量上限（可选）
- textLimit: 正文截断上限（可选）
- useSystemBrowser: 设为 false 强制无头浏览器
- cdpUrl/debugPort/systemBrowserPath: 不使用
输出：
- analysis: 正文长度、链接数量、来源集中度

## 脚本资源

- scripts/browser_search.mjs：执行多引擎搜索并输出结构化结果
- scripts/browser_scrape.mjs：抓取页面正文与链接
- extensions/browser/install_chromium.mjs：手动下载浏览器资源到扩展目录
