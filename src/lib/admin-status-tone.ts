/**
 * Единый смысл цвета в рабочих разделах.
 *
 * Опись показала, что цвет перестал что-либо значить: оранжевый нёс
 * девять разных смыслов (ожидание, частичный успех, роль модератора,
 * ограничение аккаунта, метка источника лота, сумма к выплате), красный
 * — восемь, включая «новая заявка» и «заблокирован» одновременно.
 * Хуже того, один смысл красился по-разному: «в работе» у заявки синий,
 * у обращения бирюзовый; «приостановлен» у партнёра серый, у магазина
 * красный.
 *
 * Сотрудник читает цвет быстрее подписи. Когда красный значит и «сделай
 * сейчас», и «этот заблокирован», и «источник лота», цвет превращается
 * в шум, и человек перестаёт на него смотреть.
 *
 * Здесь описан не цвет, а состояние. Цвет выбирается из состояния, и
 * тогда одинаковые по смыслу вещи выглядят одинаково во всех разделах.
 */

/**
 * Состояние, которое передаёт значок.
 *
 * Список намеренно короткий: чем больше состояний, тем ближе мы к
 * прежнему разнобою. Всё, что не укладывается сюда, — не состояние, а
 * подпись, и цвет ему не нужен.
 */
export type StatusTone =
  /** Требует действия сейчас: сбой, жалоба, просрочка. */
  | "critical"
  /** Ждёт человека: очередь на проверку, новое обращение. */
  | "pending"
  /** Идёт работа: кто-то уже взялся. */
  | "active"
  /** Завершено успешно. */
  | "success"
  /** Завершено без результата: закрыто, отменено, черновик. */
  | "neutral"
  /** Ограничение наложено: заблокирован, приостановлен, отклонён. */
  | "restricted"
  /** Не состояние, а метка: источник, страна, счётчик. */
  | "label"

/** Цвет Mantine для каждого состояния. */
const TONE_COLORS: Record<StatusTone, string> = {
  /* Красный только для того, что требует вмешательства. Раньше им
     красили новые заявки — от этого он перестал означать тревогу. */
  critical: "red",
  /* Ожидание — янтарный: заметно, но не тревожно. Прежде очередь
     красилась то оранжевым, то жёлтым, то синим, то красным. */
  pending: "orange",
  active: "blue",
  success: "teal",
  neutral: "gray",
  /* Ограничения отделены от сбоев: «заблокирован» — это не авария, а
     решение, и путать их нельзя. */
  restricted: "grape",
  label: "gray",
}

/** Цвет по состоянию. */
export function toneColor(tone: StatusTone): string {
  return TONE_COLORS[tone]
}

/**
 * Состояния, при которых значок должен быть заметен.
 *
 * Заливка вместо подсветки: очередь и сбои теряются среди светлых
 * значков, если выглядят так же, как нейтральные метки.
 */
export function toneVariant(tone: StatusTone): "filled" | "light" {
  return tone === "critical" ? "filled" : "light"
}

/** Описание статуса: цвет вычисляется из состояния, а не задаётся вручную. */
export type StatusDescriptor = { label: string; tone: StatusTone }

/**
 * Готовит значок к отображению.
 *
 * Возвращает и цвет, и вид: разделы перестают решать это каждый по-своему.
 */
export function statusBadge(descriptor: StatusDescriptor) {
  return {
    label: descriptor.label,
    color: toneColor(descriptor.tone),
    variant: toneVariant(descriptor.tone),
  }
}

/** Заявка на импорт с аукциона. */
export const AUCTION_INQUIRY_STATUS: Record<string, StatusDescriptor> = {
  /* Новая заявка ждёт человека, а не сигнализирует об аварии: раньше она
     была красной и заглушала настоящие сбои. */
  NEW: { label: "Новая", tone: "pending" },
  CONTACTED: { label: "Уточнение", tone: "active" },
  IN_PROGRESS: { label: "В работе", tone: "active" },
  CLOSED: { label: "Закрыто", tone: "neutral" },
  SOLD: { label: "Выкуплено", tone: "success" },
}

/** Обращение в поддержку. */
export const SUPPORT_TICKET_STATUS: Record<string, StatusDescriptor> = {
  OPEN: { label: "Помощник отвечает", tone: "active" },
  WAITING_OPERATOR: { label: "Ждёт оператора", tone: "pending" },
  /* Прежде «в работе» было бирюзовым — цветом успеха: обращение
     выглядело решённым, пока им ещё занимались. */
  IN_PROGRESS: { label: "В работе", tone: "active" },
  CLOSED: { label: "Закрыто", tone: "neutral" },
}

/** Аккаунт пользователя. */
export const USER_ACCOUNT_STATUS: Record<string, StatusDescriptor> = {
  ACTIVE: { label: "Активен", tone: "success" },
  RESTRICTED: { label: "Ограничен", tone: "restricted" },
  BANNED: { label: "Заблокирован", tone: "restricted" },
}

/** Партнёр по доставке. */
export const PARTNER_STATUS: Record<string, StatusDescriptor> = {
  PENDING: { label: "Ожидает проверки", tone: "pending" },
  VERIFIED: { label: "Проверен", tone: "success" },
  REJECTED: { label: "Отклонён", tone: "restricted" },
  /* «Приостановлен» был серым у партнёра и красным у магазина: одно и
     то же решение выглядело то нейтральным, то аварийным. */
  SUSPENDED: { label: "Приостановлен", tone: "restricted" },
}

/** Магазин запчастей. */
export const PART_STORE_STATUS: Record<string, StatusDescriptor> = {
  PENDING: { label: "Ждёт проверки", tone: "pending" },
  ACTIVE: { label: "Опубликован", tone: "success" },
  SUSPENDED: { label: "Приостановлен", tone: "restricted" },
  DRAFT: { label: "Черновик", tone: "neutral" },
}

/** Прогон синхронизации. */
export const SYNC_RUN_STATUS: Record<string, StatusDescriptor> = {
  SUCCEEDED: { label: "Завершён", tone: "success" },
  /* «Частично» и «завершено частично» были оранжевым и жёлтым: одно
     состояние в двух цветах на соседних экранах. */
  PARTIAL: { label: "Частично", tone: "pending" },
  FAILED: { label: "Ошибка", tone: "critical" },
  RUNNING: { label: "Выполняется", tone: "active" },
}

/** Платёжный заказ. */
export const PAYMENT_STATUS: Record<string, StatusDescriptor> = {
  PENDING: { label: "Ожидает оплаты", tone: "pending" },
  PAID: { label: "Оплачен", tone: "success" },
  FAILED: { label: "Ошибка", tone: "critical" },
  CANCELED: { label: "Отменён", tone: "neutral" },
  REFUNDED: { label: "Возвращён", tone: "neutral" },
  REVIEW_REQUIRED: { label: "Нужна проверка", tone: "pending" },
}

/**
 * Ищет описание статуса, не роняя страницу на незнакомом значении.
 *
 * Незнакомый статус — это не ошибка отображения: в базе появляются новые
 * значения раньше, чем их учтёт админка.
 */
export function describeStatus(
  dictionary: Record<string, StatusDescriptor>,
  status: string | null | undefined,
): StatusDescriptor {
  if (!status) return { label: "Неизвестно", tone: "neutral" }
  return dictionary[status] || { label: status, tone: "neutral" }
}
