/** @param {string} title @param {number} count @param {string} noun */
export function savedSearchTelegramText(title, count, noun) {
  const safe = title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  return `🔔 <b>${count} ${noun}</b> по подписке «${safe}»\n\nОткрыть выдачу с вашими фильтрами:`
}
