/**
 * Правила реакций и репутации на форуме.
 *
 * «Спасибо, помогло» пишут отдельным сообщением, и в теме о ремонте
 * половина ответов — благодарности, между которыми теряется суть.
 * Реакция говорит то же самое, не занимая места в разговоре.
 *
 * Здесь только правила и подсчёты, без обращения к базе: они одинаковы
 * на сервере и в браузере. Запись — в forum-reputation-store.ts.
 */

/**
 * Виды реакций.
 *
 * Список закрытый и короткий намеренно: два десятка значков превращают
 * ответы в ярмарку, где выбирают картинку, а не оценивают ответ. Три
 * вида покрывают то, ради чего на форум о технике приходят: помогло,
 * спасибо, всё верно.
 */
export const REACTION_KINDS = [
  { kind: "HELPFUL", label: "Помогло", icon: "IconBulb" },
  { kind: "THANKS", label: "Спасибо", icon: "IconHeart" },
  { kind: "ACCURATE", label: "Всё верно", icon: "IconCheck" },
] as const

export type ReactionKind = (typeof REACTION_KINDS)[number]["kind"]

const KIND_SET = new Set<string>(REACTION_KINDS.map((item) => item.kind))

export function isReactionKind(value: string): value is ReactionKind {
  return KIND_SET.has(value)
}

/**
 * Сколько репутации даёт что.
 *
 * Отмеченный ответ весит вдесятеро больше реакции: собрать десяток
 * «спасибо» под общим рассуждением легче, чем один раз действительно
 * решить чужую поломку, и репутация должна отражать именно это.
 */
export const REPUTATION_WEIGHTS = {
  reaction: 1,
  bestAnswer: 10,
} as const

/**
 * Звание по репутации.
 *
 * Звания начинаются не с нуля: новичок без единого ответа не заслужил
 * подписи, а пустая строка под именем читается честнее, чем «Новичок».
 */
const RANKS = [
  { from: 500, title: "Мастер" },
  { from: 200, title: "Знаток" },
  { from: 50, title: "Опытный" },
  { from: 10, title: "Участник" },
] as const

export function reputationRank(reputation: number): string | null {
  for (const rank of RANKS) {
    if (reputation >= rank.from) return rank.title
  }
  return null
}

/** Склонение: 1 раз, 2 раза, 5 раз. */
export function pluralTimes(count: number): string {
  const mod100 = count % 100
  const mod10 = count % 10
  if (mod100 >= 11 && mod100 <= 14) return `${count} раз`
  if (mod10 === 1) return `${count} раз`
  if (mod10 >= 2 && mod10 <= 4) return `${count} раза`
  return `${count} раз`
}

/**
 * Может ли человек реагировать на это сообщение.
 *
 * Своё сообщение — нельзя: реакция на самого себя это способ поднять
 * репутацию из ничего. Удалённое — тоже: под пометкой «удалено
 * модератором» оценивать нечего.
 */
export function canReactToPost(input: {
  postAuthorId: string
  viewerId: string | null
  postDeleted: boolean
}): boolean {
  if (!input.viewerId) return false
  if (input.postDeleted) return false
  return input.postAuthorId !== input.viewerId
}

/**
 * Может ли человек отметить сообщение лучшим ответом.
 *
 * Отмечает автор темы: он единственный знает, что именно решило его
 * вопрос. Свой же ответ отметить нельзя — иначе отметка становится
 * способом подписать собственное сообщение.
 */
export function canMarkBestAnswer(input: {
  topicAuthorId: string
  postAuthorId: string
  viewerId: string | null
  postDeleted: boolean
}): boolean {
  if (!input.viewerId) return false
  if (input.postDeleted) return false
  if (input.topicAuthorId !== input.viewerId) return false
  return input.postAuthorId !== input.viewerId
}
