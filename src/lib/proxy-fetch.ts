import http from "node:http"
import https from "node:https"
import { connect as tlsConnect } from "node:tls"
import { URL } from "node:url"

/**
 * HTTPS-запрос через HTTP-прокси.
 *
 * Провайдер перевода отвечает 451 на запросы из региона сервера, поэтому
 * обращения к нему идут через прокси. Node не умеет отправлять fetch через
 * прокси без внешних пакетов, а тянуть зависимость ради одного вызова
 * незачем: туннель CONNECT делает то же самое штатными модулями.
 */

export type ProxyEndpoint = {
  host: string
  port: number
  username?: string
  password?: string
}

export type ProxyResponse = {
  status: number
  ok: boolean
  text: string
}

/**
 * Разбирает список прокси из переменной окружения.
 *
 * Формат строки — `host:port:логин:пароль`, записи разделяются запятой или
 * переводом строки. Логин и пароль необязательны.
 */
export function parseProxyList(value: string | undefined | null): ProxyEndpoint[] {
  if (!value) return []
  return value
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry): ProxyEndpoint | null => {
      const [host, port, username, password] = entry.split(":")
      const parsedPort = Number(port)
      if (!host || !Number.isInteger(parsedPort) || parsedPort <= 0) return null
      return { host, port: parsedPort, username: username || undefined, password: password || undefined }
    })
    .filter((endpoint): endpoint is ProxyEndpoint => endpoint !== null)
}

/** Открывает туннель к целевому узлу через HTTP-прокси. */
function openTunnel(proxy: ProxyEndpoint, targetHost: string, targetPort: number, timeoutMs: number) {
  return new Promise<import("node:net").Socket>((resolve, reject) => {
    const headers: Record<string, string> = { Host: `${targetHost}:${targetPort}` }
    if (proxy.username) {
      const credentials = Buffer.from(`${proxy.username}:${proxy.password || ""}`).toString("base64")
      headers["Proxy-Authorization"] = `Basic ${credentials}`
    }

    const request = http.request({
      host: proxy.host,
      port: proxy.port,
      method: "CONNECT",
      path: `${targetHost}:${targetPort}`,
      headers,
      timeout: timeoutMs,
    })

    // Промис должен завершиться один раз: прокси может прислать и ответ, и
    // ошибку сокета, а двойное разрешение прячет настоящую причину сбоя.
    let settled = false
    const fail = (error: Error) => {
      if (settled) return
      settled = true
      request.destroy()
      reject(error)
    }

    request.on("connect", (response, socket) => {
      if (settled) return
      if (response.statusCode !== 200) {
        socket.destroy()
        fail(new Error(`Прокси ${proxy.host} отклонил туннель: HTTP ${response.statusCode}`))
        return
      }
      settled = true
      resolve(socket)
    })
    request.on("timeout", () => fail(new Error(`Прокси ${proxy.host} не ответил за ${timeoutMs} мс`)))
    request.on("error", fail)
    request.end()
  })
}

/**
 * Выполняет POST-запрос с телом JSON через прокси.
 *
 * Возвращает статус и текст ответа — этого достаточно вызывающему коду, а
 * полноценный Response тянул бы за собой ещё один слой совместимости.
 */
export async function proxyJsonPost(
  url: string,
  proxy: ProxyEndpoint,
  options: { headers?: Record<string, string>; body: string; timeoutMs?: number },
): Promise<ProxyResponse> {
  const target = new URL(url)
  const timeoutMs = options.timeoutMs ?? 30_000
  const port = Number(target.port || 443)
  const socket = await openTunnel(proxy, target.hostname, port, timeoutMs)

  return new Promise<ProxyResponse>((resolve, reject) => {
    let settled = false
    const fail = (error: Error) => {
      if (settled) return
      settled = true
      socket.destroy()
      reject(error)
    }

    const secureSocket = tlsConnect({ socket, servername: target.hostname }, () => {
      const request = https.request({
        createConnection: () => secureSocket,
        host: target.hostname,
        port,
        path: `${target.pathname}${target.search}`,
        method: "POST",
        headers: {
          ...options.headers,
          "Content-Length": Buffer.byteLength(options.body).toString(),
        },
        timeout: timeoutMs,
      }, (response) => {
        const chunks: Buffer[] = []
        response.on("data", (chunk: Buffer) => chunks.push(chunk))
        response.on("error", fail)
        response.on("end", () => {
          if (settled) return
          settled = true
          const status = response.statusCode || 0
          resolve({ status, ok: status >= 200 && status < 300, text: Buffer.concat(chunks).toString("utf8") })
          secureSocket.destroy()
        })
      })

      request.on("timeout", () => fail(new Error(`Ответ от ${target.hostname} не получен за ${timeoutMs} мс`)))
      request.on("error", fail)
      request.write(options.body)
      request.end()
    })

    secureSocket.on("error", fail)
  })
}

/**
 * Скачивает файл через прокси.
 *
 * Часть площадок ограничивает скорость по адресу сервера: Carsensor отдаёт
 * снимок со скоростью 178 байт в секунду, и файл в 37 КБ не доходит целиком.
 * Через прокси тот же файл приходит за доли секунды.
 */
export async function proxyGetBuffer(
  url: string,
  proxy: ProxyEndpoint,
  options: { headers?: Record<string, string>; timeoutMs?: number; maxBytes?: number } = {},
): Promise<{ status: number; ok: boolean; contentType: string | null; body: Buffer }> {
  const target = new URL(url)
  const timeoutMs = options.timeoutMs ?? 30_000
  const maxBytes = options.maxBytes ?? 8 * 1024 * 1024
  const port = Number(target.port || 443)
  const socket = await openTunnel(proxy, target.hostname, port, timeoutMs)

  return new Promise((resolve, reject) => {
    let settled = false
    const fail = (error: Error) => {
      if (settled) return
      settled = true
      socket.destroy()
      reject(error)
    }

    const secureSocket = tlsConnect({ socket, servername: target.hostname }, () => {
      const request = https.request({
        createConnection: () => secureSocket,
        host: target.hostname,
        port,
        path: `${target.pathname}${target.search}`,
        method: "GET",
        headers: options.headers,
        timeout: timeoutMs,
      }, (response) => {
        const chunks: Buffer[] = []
        let received = 0
        response.on("data", (chunk: Buffer) => {
          received += chunk.length
          // Обрыв по превышению размера защищает память: содержимое чужое и
          // заявленной длине верить нельзя.
          if (received > maxBytes) {
            response.destroy()
            fail(new Error(`Файл превышает ${maxBytes} байт`))
            return
          }
          chunks.push(chunk)
        })
        response.on("error", fail)
        response.on("end", () => {
          if (settled) return
          settled = true
          const status = response.statusCode || 0
          resolve({
            status,
            ok: status >= 200 && status < 300,
            contentType: response.headers["content-type"] || null,
            body: Buffer.concat(chunks),
          })
          secureSocket.destroy()
        })
      })

      request.on("timeout", () => fail(new Error(`Файл с ${target.hostname} не получен за ${timeoutMs} мс`)))
      request.on("error", fail)
      request.end()
    })

    secureSocket.on("error", fail)
  })
}
