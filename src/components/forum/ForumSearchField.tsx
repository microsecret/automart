"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ActionIcon, TextInput } from "@mantine/core"
import { IconSearch } from "@tabler/icons-react"

/**
 * Поле поиска по форуму.
 *
 * Переход по адресу, а не запрос из браузера: страница результатов
 * серверная, и ссылка на поиск, отправленная другу, должна открыться
 * сразу с ними.
 */
export default function ForumSearchField({ initialQuery }: { initialQuery: string }) {
  const router = useRouter()
  const [value, setValue] = useState(initialQuery)

  const submit = () => {
    const query = value.trim()
    if (query.length < 3) return
    router.push(`/forum/search?q=${encodeURIComponent(query)}`)
  }

  return (
    <TextInput
      value={value}
      onChange={(event) => setValue(event.currentTarget.value)}
      /* Ввод отправляет запрос: искать нажатием на значок после набора
         никто не станет. */
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault()
          submit()
        }
      }}
      placeholder="Что искать: марка, деталь, номер ошибки"
      size="md"
      /* Значок только справа и кнопкой: слева он был бы вторым таким же
         в одном поле и ничего бы не добавлял. */
      rightSection={
        <ActionIcon
          variant="subtle"
          color="gray"
          onClick={submit}
          disabled={value.trim().length < 3}
          aria-label="Искать"
        >
          <IconSearch size={16} />
        </ActionIcon>
      }
      aria-label="Поиск по форуму"
    />
  )
}
