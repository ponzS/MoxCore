---
name: system-browser
description: 使用系统浏览器通过 CDP 连接进行搜索与抓取。用于需要复用登录态、扩展或本地浏览器配置的任务。
---

# System Browser

## 能力概览

- 通过 `browser_search` / `browser_scrape` 连接系统浏览器执行搜索与抓取
- 支持 `cdpUrl` 连接已开启调试端口的浏览器
- 支持 `systemBrowserPath` 启动指定浏览器并复用用户环境
- 调试端口默认 9222，系统浏览器 profile 目录为 extensions/browser/system-profile

## 适用场景

- 需要登录态、Cookies、扩展或本地证书
- 需要复用用户环境（验证码、2FA、企业代理等）

## 推荐流程

1. 已有可用浏览器：优先提供 `cdpUrl`
2. 需要自动启动：提供 `systemBrowserPath` 或 `debugPort`
3. 使用 `browser_search` / `browser_scrape` 获取结果

## 工具用法

### browser_search

参数：
- query: 搜索关键词
- limit: 返回条数（可选）
- engines: 搜索引擎列表（可选，支持 baidu, google, bing）
- useSystemBrowser: 设为 true（或省略）
- cdpUrl: 连接现有浏览器的 CDP 地址（可选）
- debugPort: 系统浏览器调试端口（可选，默认 9222）
- systemBrowserPath: 系统浏览器可执行文件路径（可选，优先使用）

### browser_scrape

参数：
- url: 目标地址
- linkLimit: 返回链接数量上限（可选）
- textLimit: 正文截断上限（可选）
- useSystemBrowser: 设为 true（或省略）
- cdpUrl: 连接现有浏览器的 CDP 地址（可选）
- debugPort: 系统浏览器调试端口（可选，默认 9222）
- systemBrowserPath: 系统浏览器可执行文件路径（可选，优先使用）
输出：
- analysis: 正文长度、链接数量、来源集中度

## 注意事项

- 若找不到系统浏览器可执行文件会报错，优先指定 `systemBrowserPath`
- 会尝试连接已开启调试端口，失败后再启动本地浏览器
