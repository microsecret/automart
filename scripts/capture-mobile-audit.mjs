import { spawn } from "node:child_process"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

const [, , baseUrl = "http://127.0.0.1:4011", outputDirectory = "artifacts/mobile-audit"] = process.argv
const chromePath = process.env.CHROME_PATH || path.join(process.env.PROGRAMFILES || "C:\\Program Files", "Google", "Chrome", "Application", "chrome.exe")
const debugPort = 9333
const resolvedOutputDirectory = path.resolve(outputDirectory)
const captures = [
  ["home-desktop.png", "/?audit=cdp-desktop", 1440, 1000, false],
  ["auctions-laptop.png", "/auctions?country=KR&audit=cdp-laptop", 1280, 900, false],
  ["auctions-desktop.png", "/auctions?country=KR&audit=cdp-desktop", 1440, 1000, false],
  ["news-desktop.png", "/news?sort=popular&audit=cdp-desktop", 1440, 1000, false],
  ["smart-matching-desktop.png", "/services/smart-matching?audit=cdp-desktop", 1440, 1000, false],
  ["history-check-desktop.png", "/services/history-check?audit=cdp-desktop", 1440, 1000, false],
  ["history-check-wide.png", "/services/history-check?audit=cdp-wide", 2520, 1696, false],
  ["support-mobile.png", "/help/support?audit=cdp-mobile", 390, 844, true],
  ["signup-mobile.png", "/auth/signup?audit=cdp-mobile", 390, 844, true],
  ["telegram-mobile.png", "/telegram?audit=cdp-mobile", 390, 844, true],
]
const auditSessionToken = process.env.AUDIT_SESSION_TOKEN?.trim()
if (auditSessionToken) {
  captures.push(
    ["admin-overview-desktop.png", "/admin?audit=cdp-auth", 1440, 1000, false],
    ["admin-users-desktop.png", "/admin/users?audit=cdp-auth", 1440, 1000, false],
    ["admin-support-desktop.png", "/admin/support?audit=cdp-auth", 1440, 1000, false],
    ["dashboard-mobile.png", "/dashboard?audit=cdp-auth", 390, 844, true],
  )
}

await mkdir(resolvedOutputDirectory, { recursive: true })

const chrome = spawn(chromePath, [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--no-first-run",
  "--disable-extensions",
  "--no-sandbox",
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${path.join(resolvedOutputDirectory, "chrome-cdp-profile")}`,
  "about:blank",
], { stdio: ["ignore", "ignore", "inherit"], windowsHide: true })

async function waitForDebugger() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (chrome.exitCode !== null) throw new Error(`Chrome exited before DevTools started (code ${chrome.exitCode})`)
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/version`)
      if (response.ok) return
    } catch {
      // Chrome is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error("Chrome DevTools endpoint did not start")
}

try {
  await waitForDebugger()
  const targetResponse = await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" })
  const target = await targetResponse.json()
  const socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.onopen = resolve
    socket.onerror = reject
  })

  let nextId = 1
  const pending = new Map()
  const listeners = new Map()

  socket.onmessage = (event) => {
    const payload = JSON.parse(String(event.data))
    if (payload.id && pending.has(payload.id)) {
      const callbacks = pending.get(payload.id)
      pending.delete(payload.id)
      if (payload.error) callbacks.reject(new Error(payload.error.message))
      else callbacks.resolve(payload.result)
      return
    }
    if (auditSessionToken && payload.method === "Fetch.requestPaused") {
      const headers = Object.entries(payload.params.request.headers || {})
        .filter(([name]) => name.toLowerCase() !== "cookie")
        .map(([name, value]) => ({ name, value: String(value) }))
      headers.push({
        name: "Cookie",
        value: `next-auth.session-token=${auditSessionToken}; __Secure-next-auth.session-token=${auditSessionToken}`,
      })
      send("Fetch.continueRequest", { requestId: payload.params.requestId, headers })
        .catch((error) => process.stderr.write(`Failed to continue authenticated audit request: ${error.message}\n`))
      return
    }
    const queue = listeners.get(payload.method)
    if (queue?.length) queue.shift()(payload.params)
  }

  const send = (method, params = {}) => {
    const id = nextId
    nextId += 1
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject })
      socket.send(JSON.stringify({ id, method, params }))
    })
  }

  const waitForEvent = (method, timeoutMs = 45_000) => new Promise((resolve, reject) => {
    const queue = listeners.get(method) || []
    const onEvent = (params) => {
      clearTimeout(timeout)
      resolve(params)
    }
    const timeout = setTimeout(() => {
      const activeQueue = listeners.get(method) || []
      const index = activeQueue.indexOf(onEvent)
      if (index >= 0) activeQueue.splice(index, 1)
      reject(new Error(`Timed out waiting for ${method} after ${timeoutMs}ms`))
    }, timeoutMs)
    queue.push(onEvent)
    listeners.set(method, queue)
  })

  await send("Page.enable")
  await send("Network.enable")
  if (auditSessionToken) await send("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] })
  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 })
  if (auditSessionToken) {
    await send("Network.setExtraHTTPHeaders", {
      headers: {
        Cookie: `next-auth.session-token=${auditSessionToken}; __Secure-next-auth.session-token=${auditSessionToken}`,
      },
    })
    const cookieResult = await send("Network.setCookie", {
      name: "next-auth.session-token",
      value: auditSessionToken,
      url: new URL(baseUrl).origin,
      httpOnly: true,
      sameSite: "Lax",
      secure: new URL(baseUrl).protocol === "https:",
    })
    if (!cookieResult.success) throw new Error("Failed to install isolated audit session cookie")
  }

  for (const [filename, route, width, height, mobile] of captures) {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile,
      screenWidth: width,
      screenHeight: height,
    })
    await send("Emulation.setTouchEmulationEnabled", mobile
      ? { enabled: true, maxTouchPoints: 5 }
      : { enabled: false })
    const loaded = waitForEvent("Page.loadEventFired")
    await send("Page.navigate", { url: new URL(route, baseUrl).toString() })
    await loaded
    await new Promise((resolve) => setTimeout(resolve, 4500))
    const layout = await send("Runtime.evaluate", {
      expression: `(() => {
        const footer = document.querySelector(".market-app-footer")?.getBoundingClientRect()
        const appMainElement = document.querySelector("main")
        const appMain = appMainElement?.getBoundingClientRect()
        const appMainStyle = appMainElement ? getComputedStyle(appMainElement) : null
        const headerUtility = document.querySelector(".market-app-header__utility")?.getBoundingClientRect()
        return JSON.stringify({
          url: location.pathname,
          title: document.title,
          viewport: innerWidth,
          viewportHeight: innerHeight,
          scrollWidth: document.documentElement.scrollWidth,
          scrollHeight: document.documentElement.scrollHeight,
          bodyWidth: document.body.scrollWidth,
          footer: footer ? {
            left: Math.round(footer.left),
            right: Math.round(footer.right),
            top: Math.round(footer.top + scrollY),
            bottom: Math.round(footer.bottom + scrollY),
          } : null,
          appMain: appMain ? {
            left: Math.round(appMain.left + parseFloat(appMainStyle?.paddingLeft || "0")),
            right: Math.round(appMain.right - parseFloat(appMainStyle?.paddingRight || "0")),
          } : null,
          headerUtility: headerUtility ? {
            left: Math.round(headerUtility.left),
            right: Math.round(headerUtility.right),
          } : null,
        })
      })()`,
      returnByValue: true,
    })
    const layoutMetrics = JSON.parse(layout.result.value)
    if (layoutMetrics.scrollWidth > layoutMetrics.viewport || layoutMetrics.bodyWidth > layoutMetrics.viewport) {
      throw new Error(`${route} has horizontal overflow: viewport=${layoutMetrics.viewport}, document=${layoutMetrics.scrollWidth}, body=${layoutMetrics.bodyWidth}`)
    }
    if (layoutMetrics.headerUtility && (layoutMetrics.headerUtility.left < 0 || layoutMetrics.headerUtility.right > layoutMetrics.viewport)) {
      throw new Error(`${route} clips header actions: left=${layoutMetrics.headerUtility.left}, right=${layoutMetrics.headerUtility.right}, viewport=${layoutMetrics.viewport}`)
    }
    if (!route.startsWith("/auth/") && !route.startsWith("/telegram")) {
      if (!layoutMetrics.footer) throw new Error(`${route} does not render the marketplace footer`)
      const expectedLeft = layoutMetrics.appMain?.left || 0
      const expectedRight = layoutMetrics.appMain?.right || layoutMetrics.viewport
      if (Math.abs(layoutMetrics.footer.left - expectedLeft) > 1 || Math.abs(layoutMetrics.footer.right - expectedRight) > 1) {
        throw new Error(`${route} footer does not span the content column: left=${layoutMetrics.footer.left}, right=${layoutMetrics.footer.right}, expected=${expectedLeft}..${expectedRight}`)
      }
      if (Math.abs(layoutMetrics.scrollHeight - layoutMetrics.footer.bottom) > 4) {
        throw new Error(`${route} leaves space after the footer: footerBottom=${layoutMetrics.footer.bottom}, document=${layoutMetrics.scrollHeight}`)
      }
    }
    const screenshot = await send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: false,
    })
    const outputPath = path.join(resolvedOutputDirectory, filename)
    await writeFile(outputPath, Buffer.from(screenshot.data, "base64"))
    process.stdout.write(`${outputPath} · ${layoutMetrics.title} · ${layoutMetrics.viewport}×${layoutMetrics.viewportHeight}px · document ${layoutMetrics.scrollHeight}px\n`)

    if (filename === "support-mobile.png") {
      const opened = await send("Runtime.evaluate", {
        expression: `(() => {
          const launcher = document.querySelector('[aria-label="Открыть поддержку"]')
          if (!(launcher instanceof HTMLElement)) return false
          launcher.click()
          return true
        })()`,
        returnByValue: true,
      })
      if (!opened.result.value) throw new Error("Guest support launcher is not interactive on mobile")
      await new Promise((resolve) => setTimeout(resolve, 800))

      const panelLayout = await send("Runtime.evaluate", {
        expression: `(() => {
          const panel = document.querySelector(".support-chat__panel")?.getBoundingClientRect()
          return panel ? JSON.stringify({ left: panel.left, top: panel.top, right: panel.right, bottom: panel.bottom }) : null
        })()`,
        returnByValue: true,
      })
      if (!panelLayout.result.value) throw new Error("Guest support panel did not open on mobile")
      const panel = JSON.parse(panelLayout.result.value)
      if (panel.left < 0 || panel.top < 0 || panel.right > width || panel.bottom > height) {
        throw new Error(`Guest support panel leaves the mobile viewport: ${JSON.stringify(panel)}`)
      }

      const openedChat = await send("Page.captureScreenshot", {
        format: "png",
        fromSurface: true,
        captureBeyondViewport: false,
      })
      const chatOutputPath = path.join(resolvedOutputDirectory, "support-chat-mobile.png")
      await writeFile(chatOutputPath, Buffer.from(openedChat.data, "base64"))
      process.stdout.write(`${chatOutputPath} · guest support opened within ${width}×${height}px\n`)
    }
  }

  await send("Browser.close")
  socket.close()
} finally {
  if (!chrome.killed) chrome.kill()
}
