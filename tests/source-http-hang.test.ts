import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import http from "node:http"
import type https from "node:https"
import type { AddressInfo } from "node:net"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { authorizedSourceGet, requestTextOnce, sourceProxyPoolStatus } from "../src/lib/authorized-source-http.ts"

/* Источник прислал заголовки и половину тела, дальше — тишина или обрыв.
   При обрыве прежний промис не завершался никогда: так зависали 13%
   прогонов Encar. Тест проходит по http, чтобы не держать сертификат. */
function serve(behaviour: "stall" | "cut" | "ok") {
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "text/html" })
    response.write("<html>половина")
    if (behaviour === "ok") response.end("</html>")
    if (behaviour === "cut") setTimeout(() => response.socket?.destroy(), 30)
  })
  return new Promise<{ url: URL; close: () => void }>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo
      resolve({
        url: new URL(`http://127.0.0.1:${port}/`),
        close: () => { server.closeAllConnections(); server.close() },
      })
    })
  })
}

const agent = new http.Agent() as unknown as https.Agent
const send = http.request as unknown as typeof https.request

test("зависший посреди тела ответ отклоняется по таймауту", async () => {
  const { url, close } = await serve("stall")
  const started = Date.now()
  try {
    await assert.rejects(requestTextOnce(url, agent, "GET", {}, undefined, 300, 1_000_000, send))
    assert.ok(Date.now() - started < 2_000, "отказ должен прийти вскоре после таймаута")
  } finally {
    close()
  }
})

test("оборванное посреди тела соединение отклоняется сразу", async () => {
  const { url, close } = await serve("cut")
  try {
    await assert.rejects(requestTextOnce(url, agent, "GET", {}, undefined, 5_000, 1_000_000, send), /оборвал/)
  } finally {
    close()
  }
})

test("полный ответ по-прежнему приходит целиком", async () => {
  const { url, close } = await serve("ok")
  try {
    const result = await requestTextOnce(url, agent, "GET", {}, undefined, 2_000, 1_000_000, send)
    assert.equal(result.status, 200)
    assert.equal(result.body, "<html>половина</html>")
  } finally {
    close()
  }
})

test("CONNECT 407 сразу выводит прокси из ротации, не подменяя ошибку источника", async () => {
  let rejected = 0
  const proxy = http.createServer()
  proxy.on("connect", (_request, socket) => {
    rejected++
    socket.end("HTTP/1.1 407 Proxy Authentication Required\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
  })
  const previous = process.env.AUCTION_PROXY_POOL
  try {
    await new Promise<void>((resolve) => proxy.listen(0, "127.0.0.1", resolve))
    const port = (proxy.address() as AddressInfo).port
    process.env.AUCTION_PROXY_POOL = `127.0.0.1:${port}:test:fixture`
    const url = `https://127.0.0.1:${port}/source`
    const options = { allowedHosts: new Set(["127.0.0.1"]), headers: {}, timeoutMs: 1_200, maxBytes: 4096 }
    // The local fixture only speaks HTTP. Its direct TLS request must fail.
    for (let pass = 0; pass < 2; pass++) {
      await assert.rejects(authorizedSourceGet(url, options), (error: Error) => !error.message.includes("407"))
      assert.equal(sourceProxyPoolStatus().quarantined, 1)
    }
    assert.equal(rejected, 1)
  } finally {
    if (previous === undefined) delete process.env.AUCTION_PROXY_POOL
    else process.env.AUCTION_PROXY_POOL = previous
    proxy.closeAllConnections()
    proxy.close()
  }
})

test("повторная ошибка запроса не становится uncaughtException", async () => {
  /* Агент прокси при обрыве CONNECT испускает error дважды. С одноразовым
     слушателем второе событие уходило в uncaughtException — ~100 в сутки. */
  const fakeSend = (() => {
    const request = new EventEmitter() as EventEmitter & { destroyed: boolean; destroy: (error?: Error) => void; setTimeout: () => void; end: () => void }
    request.destroyed = false
    request.destroy = () => { request.destroyed = true }
    request.setTimeout = () => undefined
    request.end = () => {
      setTimeout(() => request.emit("error", new Error("Proxy connection ended before receiving CONNECT response")), 5)
      setTimeout(() => request.emit("error", new Error("повторная ошибка")), 10)
    }
    return request
  }) as unknown as typeof https.request
  let uncaught = 0
  const onUncaught = () => { uncaught += 1 }
  process.on("uncaughtException", onUncaught)
  try {
    await assert.rejects(requestTextOnce(new URL("https://example.test/"), agent, "GET", {}, undefined, 1_000, 1_000, fakeSend), /Proxy connection ended/)
    await new Promise((resolve) => setTimeout(resolve, 30))
    assert.equal(uncaught, 0)
  } finally {
    process.off("uncaughtException", onUncaught)
  }
})
