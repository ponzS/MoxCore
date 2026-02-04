---
name: browser
description: 使用无头浏览器进行网页搜索、页面抓取与资源收集。用于需要浏览器渲染、搜索结果解析或网页正文提取的任务。
---

# Browser

## 能力概览

- 通过 `browser_search` 结合百度、谷歌、必应执行搜索，返回标题/链接/摘要/分析
- 通过 `browser_scrape` 访问页面并提取正文与链接
- 需要脚本时，使用 `scripts/` 下的可执行脚本
- 若检测到浏览器环境缺失，会自动安装并输出下载进度
- 浏览器资源默认下载到 extensions/browser/browsers

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
- useSystemBrowser: 优先连接系统浏览器（可选）
- cdpUrl: 连接现有浏览器的 CDP 地址（可选）
- debugPort: 系统浏览器调试端口（可选，默认 9222）
- systemBrowserPath: 系统浏览器可执行文件路径（可选，优先使用）

### browser_scrape

参数：
- url: 目标地址
- linkLimit: 返回链接数量上限（可选）
- textLimit: 正文截断上限（可选）
- useSystemBrowser: 优先连接系统浏览器（可选）
- cdpUrl: 连接现有浏览器的 CDP 地址（可选）
- debugPort: 系统浏览器调试端口（可选，默认 9222）
- systemBrowserPath: 系统浏览器可执行文件路径（可选，优先使用）
输出：
- analysis: 正文长度、链接数量、来源集中度

## 脚本资源

- scripts/browser_search.mjs：执行多引擎搜索并输出结构化结果
- scripts/browser_scrape.mjs：抓取页面正文与链接
- extensions/browser/install_chromium.mjs：手动下载浏览器资源到扩展目录
