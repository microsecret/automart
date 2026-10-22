/** Keep the local SQLite writer serialized without changing file or mode.
 * Non-SQLite databases retain their own connection settings. */
export function sqliteConnectionUrl(value) {
  if (!value?.startsWith("file:")) return value
  const separator = value.indexOf("?")
  const file = separator < 0 ? value : value.slice(0, separator)
  const query = new URLSearchParams(separator < 0 ? "" : value.slice(separator + 1))
  query.set("connection_limit", "1")
  query.set("socket_timeout", "5")
  query.set("pool_timeout", "5")
  return `${file}?${query}`
}

/** @template T
 * @param {{ prisma?: T }} scope
 * @param {() => T} create
 * @returns {T}
 */
export function sharedPrismaClient(scope, create) {
  if (!scope.prisma) scope.prisma = create()
  return scope.prisma
}
