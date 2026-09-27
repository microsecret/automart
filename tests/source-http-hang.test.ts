import assert from "node:assert/strict"
import http from "node:http"
import type https from "node:https"
import type { AddressInfo } from "node:net"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { requestTextOnce } from "../src/lib/authorized-source-http.ts"

/* Источник прислал заголовки и половину тела, дальше — тишина или обрыв.
   Раньше промис в этом случае не завершался никогда: так зависали 13%
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
