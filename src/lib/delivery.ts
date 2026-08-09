export type DeliveryKind = "VEHICLE" | "PART"
export type DeliverySourceType = "AUCTION" | "DIRECT_IMPORT" | "PARTS_ORDER"

export const DELIVERY_STATUSES = [
  "REQUEST_CREATED",
  "DEPOSIT_PENDING",
  "DEPOSIT_CONFIRMED",
  "VEHICLE_SELECTED",
  "INVOICE_ISSUED",
  "PURCHASE_IN_PROGRESS",
  "PURCHASED",
  "EXPORT_PREPARATION",
  "ORIGIN_DEREGISTRATION",
  "ORIGIN_CUSTOMS",
  "BORDER_TRANSIT",
  "RUSSIAN_CUSTOMS_PREPARATION",
  "BROKER_PAYMENT",
  "RUSSIAN_CUSTOMS",
  "LABORATORY",
  "EPTS",
  "RUSSIA_LOGISTICS",
  "FINAL_DELIVERY",
  "COMPLETED",
  "ON_HOLD",
  "CANCELED",
] as const

export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number]

export const DELIVERY_STATUS_META: Record<DeliveryStatus, { label: string; shortLabel: string; responsible: string; description: string; color: string }> = {
  REQUEST_CREATED: { label: "Заявка создана", shortLabel: "Заявка", responsible: "Площадка", description: "Проверяем данные заказа и подбираем ответственного партнёра.", color: "gray" },
  DEPOSIT_PENDING: { label: "Ожидается задаток", shortLabel: "Задаток", responsible: "Покупатель", description: "Счёт и условия задатка доступны после согласования сделки.", color: "orange" },
  DEPOSIT_CONFIRMED: { label: "Задаток подтверждён", shortLabel: "Задаток", responsible: "Площадка", description: "Заявка передана в работу партнёру.", color: "teal" },
  VEHICLE_SELECTED: { label: "Автомобиль выбран", shortLabel: "Выбор", responsible: "Покупатель", description: "Параметры лота, лимит и маршрут зафиксированы в сделке.", color: "indigo" },
  INVOICE_ISSUED: { label: "Счёт сформирован", shortLabel: "Счёт", responsible: "Покупатель", description: "Оплата выполняется только по проверенному счёту и реквизитам в договоре.", color: "orange" },
  PURCHASE_IN_PROGRESS: { label: "Выкуп в работе", shortLabel: "Выкуп", responsible: "Партнёр", description: "Партнёр подтверждает возможность выкупа и ориентир по срокам.", color: "violet" },
  PURCHASED: { label: "Транспорт выкуплен", shortLabel: "Выкуплено", responsible: "Партнёр", description: "Получаем первичные документы от продавца или аукциона.", color: "teal" },
  EXPORT_PREPARATION: { label: "Готовятся экспортные документы", shortLabel: "Экспорт", responsible: "Партнёр", description: "Собираем документы страны отправления и подтверждения для маршрута.", color: "blue" },
  ORIGIN_DEREGISTRATION: { label: "Снятие с учёта в стране отправления", shortLabel: "Снятие с учёта", responsible: "Партнёр", description: "Применяется к подержанному транспорту, если это требуется правилами страны отправления.", color: "blue" },
  ORIGIN_CUSTOMS: { label: "Экспортное оформление", shortLabel: "Экспортная таможня", responsible: "Брокер", description: "Статус подтверждается брокером и приложенными документами страны отправления.", color: "cyan" },
  BORDER_TRANSIT: { label: "В пути к границе или порту", shortLabel: "Транзит", responsible: "Логистика", description: "Транспорт направляется к пункту пропуска, порту или перевалочной точке.", color: "cyan" },
  RUSSIAN_CUSTOMS_PREPARATION: { label: "Готовим оформление в РФ", shortLabel: "Подготовка РФ", responsible: "Брокер", description: "Брокер сверяет пакет документов до подачи декларации.", color: "blue" },
  BROKER_PAYMENT: { label: "Ожидаются платежи по оформлению", shortLabel: "Платежи", responsible: "Покупатель", description: "Пошлины, услуги брокера и лаборатории отображаются отдельными счетами и квитанциями.", color: "orange" },
  RUSSIAN_CUSTOMS: { label: "Таможенное оформление в РФ", shortLabel: "Таможня РФ", responsible: "Брокер", description: "Статус вносится после подтверждения брокером или подключённым официальным каналом.", color: "cyan" },
  LABORATORY: { label: "Лаборатория и документы", shortLabel: "Лаборатория", responsible: "Лаборатория", description: "Выполняются предусмотренные процедуры и прикладываются результаты.", color: "violet" },
  EPTS: { label: "ЭПТС оформлен", shortLabel: "ЭПТС", responsible: "Партнёр", description: "Партнёр прикладывает подтверждение оформления ЭПТС.", color: "teal" },
  RUSSIA_LOGISTICS: { label: "Логистика по России", shortLabel: "По России", responsible: "Логистика", description: "Транспорт передан российскому логистическому партнёру по отдельному договору.", color: "indigo" },
  FINAL_DELIVERY: { label: "Доставка в город покупателя", shortLabel: "Финальная доставка", responsible: "Логистика", description: "Согласовываем выдачу или последний участок маршрута.", color: "indigo" },
  COMPLETED: { label: "Сделка завершена", shortLabel: "Завершено", responsible: "Покупатель", description: "Передача транспорта подтверждена сторонами.", color: "teal" },
  ON_HOLD: { label: "Нужна дополнительная проверка", shortLabel: "Пауза", responsible: "Площадка", description: "Срок или документ требует уточнения; причина фиксируется в ленте сделки.", color: "yellow" },
  CANCELED: { label: "Сделка отменена", shortLabel: "Отменено", responsible: "Площадка", description: "Причина и дальнейшие действия фиксируются в истории сделки.", color: "red" },
}

export const DELIVERY_PAYMENT_META: Record<string, string> = {
  DEPOSIT: "Задаток по сделке",
  VEHICLE: "Оплата транспорта продавцу",
  EXPORT: "Экспортные услуги и документы",
  BROKER: "Услуги таможенного брокера",
  DUTY: "Таможенные платежи",
  LABORATORY: "Лаборатория",
  EPTS: "Оформление ЭПТС",
  LOGISTICS: "Логистика по России",
}

export const DELIVERY_DOCUMENT_META: Record<string, string> = {
  INVOICE: "Счёт",
  RECEIPT: "Квитанция",
  EXPORT: "Экспортный документ",
  CUSTOMS: "Таможенный документ",
  LABORATORY: "Документ лаборатории",
  EPTS: "Подтверждение ЭПТС",
  CONTRACT: "Договор",
  OTHER: "Другой документ",
}

export const DELIVERY_COUNTRIES = [
  { value: "CN", label: "Китай" },
  { value: "KR", label: "Корея" },
  { value: "JP", label: "Япония" },
  { value: "AE", label: "ОАЭ" },
  { value: "US", label: "США" },
  { value: "EU", label: "Европа" },
  { value: "OTHER", label: "Другая страна" },
]

export function isDeliveryStatus(value: unknown): value is DeliveryStatus {
  return typeof value === "string" && DELIVERY_STATUSES.includes(value as DeliveryStatus)
}

export function deliveryProgress(status: string) {
  const completedIndex = DELIVERY_STATUSES.indexOf(status as DeliveryStatus)
  const lastOperationalIndex = DELIVERY_STATUSES.indexOf("COMPLETED")
  if (status === "COMPLETED") return 100
  if (status === "ON_HOLD" || status === "CANCELED" || completedIndex < 0) return 0
  return Math.max(5, Math.round((completedIndex / lastOperationalIndex) * 100))
}

export function makeDeliveryCode() {
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase()
  return `DLV-${new Date().getFullYear()}-${suffix}`
}
