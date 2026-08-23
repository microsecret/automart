/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
]

if (process.env.NODE_ENV === "production") {
  securityHeaders.push({
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "script-src 'self' 'unsafe-inline' https://telegram.org",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.telegram.org https://maps.googleapis.com https://maps.gstatic.com",
      // Страница карты вставляет фрейм OpenStreetMap. Домена в политике не
      // было, поэтому браузер блокировал врезку и вместо карты оставался
      // пустой прямоугольник — основная функция страницы не работала.
      "frame-src 'self' https://*.telegram.org https://www.openstreetmap.org",
    ].join("; "),
  })
}

if (process.env.ENABLE_HSTS === "true") {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  })
}

// Telegram Mini App открывается внутри iframe клиента Telegram, поэтому
// глобальные `frame-ancestors 'none'` и `X-Frame-Options: DENY` блокировали
// его запуск. Разрешение выдаётся точечно — только маршруту Mini App и только
// доменам Telegram, поэтому остальной сайт остаётся защищённым от кликджекинга.
const TELEGRAM_FRAME_ANCESTORS = "frame-ancestors https://web.telegram.org https://*.telegram.org https://telegram.org"

const telegramEmbedHeaders = securityHeaders
  .filter((header) => header.key !== "X-Frame-Options" && header.key !== "Cross-Origin-Opener-Policy")
  .map((header) => (
    header.key === "Content-Security-Policy"
      ? { key: header.key, value: header.value.replace("frame-ancestors 'none'", TELEGRAM_FRAME_ANCESTORS) }
      : header
  ))

const nextConfig = {
  reactStrictMode: false,
  poweredByHeader: false,
  /* Оптимизация изображений.

     Замер главной: страница весила 10.3 МБ, из них 7.8 МБ — шесть
     фотографий из /uploads. Отдавались оригиналами: снимок 4032×3024
     весом 4 МБ показывался в слоте 382×306 — в десять раз шире нужного.
     На телефоне грузилось ровно то же самое, адаптивной отдачи не было.

     Ширины подобраны под реальные слоты: 384 — карточка в каталоге,
     640/750 — телефон, дальше страница объявления и крупные экраны.
     AVIF и WebP дают выигрыш к JPEG в разы; браузер выберет, что понимает.

     Кэш на сутки: фотографии объявления не меняются после публикации. */
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [384, 640, 750, 828, 1080, 1200, 1920],
    imageSizes: [64, 96, 128, 256, 384],
    minimumCacheTTL: 86400,
    remotePatterns: [
      { protocol: "https", hostname: "ci.encar.com" },
      { protocol: "https", hostname: "**.encar.com" },
      { protocol: "https", hostname: "img.kcar.com" },
      { protocol: "https", hostname: "**.kcar.com" },
      /* Источники новостей. Обложки приходили как есть — файлы 177, 137
         и 107 КБ в слот 378×230, время до главной картинки на телефоне
         доходило до 6.5 секунды. Домены перечислены поимённо: открытый
         шаблон превратил бы обработчик в чужой прокси. */
      { protocol: "https", hostname: "www.zr.ru" },
      { protocol: "https", hostname: "avatars.avto.ru" },
      { protocol: "https", hostname: "resizer.mail.ru" },
      { protocol: "https", hostname: "img-renderer.rambler.ru" },
      { protocol: "https", hostname: "kolesa-uploads.ru" },
    ],
  },
  serverExternalPackages: ['prisma', '@prisma/client'],
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  // На VPS рядом лежат другие package-lock.json. Фиксируем корень именно
  // Авторынка, чтобы Next не захватывал чужое рабочее пространство в trace
  // и при запуске Turbopack.
  outputFileTracingRoot: __dirname,
  turbopack: {
    root: __dirname,
  },
  // Next's Windows prerender workers can terminate with 0xC0000409 when this
  // large route set is generated in parallel. Keep local Windows builds
  // deterministic; Linux production builds retain Next's normal concurrency.
  ...(process.platform === 'win32' ? { experimental: { cpus: 1 } } : {}),
  async headers() {
    // Next применяет все совпавшие правила подряд, поэтому общий шаблон
    // перезаписал бы заголовки Mini App. Маршрут Mini App исключён из общего
    // правила через missing-условие, а не только порядком объявления.
    return [
      { source: "/telegram", headers: telegramEmbedHeaders },
      { source: "/telegram/:path*", headers: telegramEmbedHeaders },
      {
        source: "/((?!telegram).*)",
        headers: securityHeaders,
      },
    ]
  },
  webpack: (config) => {
    config.module.rules.push({
      test: /\.svg$/i,
      issuer: /\.[jt]sx?$/,
      use: ['@svgr/webpack'],
    });
    return config;
  },
};
module.exports = nextConfig;
