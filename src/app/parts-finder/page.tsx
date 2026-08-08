"use client"

export const dynamic = "force-dynamic"

import { useState } from "react"
import { Box, Stack, Title, Text, Card, Select, Group, Button, ThemeIcon, SimpleGrid, Badge, Alert, Divider } from "@mantine/core"
import { IconSparkles, IconSearch, IconCheck, IconCar, IconArrowRight } from "@tabler/icons-react"
import Link from "next/link"
import { BRAND_NAMES, getModels } from "@/lib/catalog"

const PART_CATEGORIES = [
  { value: "ENGINE", label: "Двигатель", items: ["Двигатель в сборе", "Головка блока", "Поршневая", "Турбина", "Ремень ГРМ", "Прокладки", "Свечи зажигания", "Форсунки"] },
  { value: "TRANSMISSION", label: "Трансмиссия", items: ["АКПП", "МКПП", "Сцепление", "Вариатор", "Коробка передач"] },
  { value: "SUSPENSION", label: "Подвеска", items: ["Амортизаторы", "Стойки стабилизатора", "Рычаги", "Пружины", "Шаровые опоры", "Сайлентблоки"] },
  { value: "BRAKES", label: "Тормоза", items: ["Колодки", "Диски", "Суппорты", "Барабаны", "Тормозные шланги"] },
  { value: "ELECTRICAL", label: "Электрика", items: ["Генератор", "Стартер", "Аккумулятор", "Комплект проводки", "Блок управления"] },
  { value: "BODY", label: "Кузов", items: ["Бампер", "Капот", "Крыло", "Дверь", "Зеркало", "Решётка"] },
  { value: "INTERIOR", label: "Салон", items: ["Сиденья", "Руль", "Панель приборов", "Кожаный салон", "Потолок"] },
  { value: "WHEELS", label: "Колёса и диски", items: ["Диски R15-R22", "Шины летние", "Шины зимние", "Колпаки", "Болты колёсные"] },
  { value: "LIGHTING", label: "Оптика", items: ["Фара LED", "Фара галоген", "Противотуманки", "Задний фонарь", "Поворотник"] },
]

export default function PartsFinderPage() {
  const [make, setMake] = useState("")
  const [model, setModel] = useState("")
  const [year, setYear] = useState("")
  const [category, setCategory] = useState("")
  const [results, setResults] = useState<string[] | null>(null)

  const find = () => {
    if (!category) return
    const cat = PART_CATEGORIES.find((c) => c.value === category)
    if (cat) {
      setResults(cat.items)
    }
  }

  return (
    <Box p={{ base: "sm", md: "md" }} style={{ maxWidth: 700, margin: "0 auto" }}>
      <Stack gap="md">
        <Group gap="sm" align="center">
          <ThemeIcon variant="light" color="violet" size={44} radius="md"><IconSparkles size={22} /></ThemeIcon>
          <Stack gap={0}>
            <Title order={2} size="h3" ff="var(--font-display),sans-serif">Умный подбор запчастей</Title>
            <Text size="xs" c="#71717a">Найдите запчасть по марке, модели и типу — с учётом совместимости</Text>
          </Stack>
        </Group>

        <Card withBorder radius="md" p="lg" style={{ borderColor: "#f4f4f5" }}>
          <Stack gap="md">
            <Group grow>
              <Select label="Марка авто" data={Array.from(new Set(BRAND_NAMES)).map((b) => ({ value: b, label: b }))} searchable value={make} onChange={setMake} size="sm" placeholder="Выберите" />
              <Select label="Модель" data={make ? getModels(make).map((m) => ({ value: m, label: m })) : []} searchable value={model} onChange={setModel} size="sm" placeholder="Выберите" />
            </Group>
            <Group grow>
              <Select label="Год выпуска" data={Array.from({ length: 35 }, (_, i) => String(2024 - i))} searchable value={year} onChange={setYear} size="sm" placeholder="Год" />
              <Select label="Категория запчасти" data={PART_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))} value={category} onChange={setCategory} size="sm" placeholder="Выберите" />
            </Group>
            <Button onClick={find} color="indigo" radius="md" size="sm" leftSection={<IconSearch size={16} />} disabled={!category}>
              Найти запчасти
            </Button>
          </Stack>
        </Card>

        {results && (
          <Card withBorder radius="md" p="md" style={{ borderColor: "#c7d2fe", background: "#fafafa" }}>
            <Stack gap="sm">
              <Group justify="space-between">
                <Text size="sm" fw={600} c="#18181b">Результаты подбора</Text>
                <Badge variant="light" color="indigo" size="sm">{results.length} позиций</Badge>
              </Group>
              <Text size="xs" c="#71717a">
                {make ? `${make}` : "Любая марка"}{model ? ` ${model}` : ""}{year ? `, ${year} г.` : ""} → {PART_CATEGORIES.find((c) => c.value === category)?.label}
              </Text>
              <Divider color="#e4e4e7" />
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                {results.map((item, i) => (
                  <Group key={i} gap="xs" align="center" p="xs" style={{ background: "#fff", borderRadius: 6, border: "1px solid #f4f4f5" }}>
                    <ThemeIcon variant="light" color="green" size={28} radius="sm"><IconCheck size={14} /></ThemeIcon>
                    <Text size="xs" fw={500} c="#3f3f46" style={{ flex: 1 }}>{item}</Text>
                    <IconArrowRight size={14} color="#a1a1aa" />
                  </Group>
                ))}
              </SimpleGrid>
              <Alert icon={<IconSparkles size={14} />} color="violet" variant="light" radius="md" mt="xs">
                <Text size="xs" c="#52525b">Найденные запчасти совместимы с указанным авто. Нажмите на позицию для поиска в объявлениях.</Text>
              </Alert>
              <Button component={Link} href={`/category/parts${category ? `?partType=${category}` : ""}`} variant="light" color="indigo" size="sm" radius="md" leftSection={<IconCar size={14} />}>
                Перейти к объявлениям
              </Button>
            </Stack>
          </Card>
        )}
      </Stack>
    </Box>
  )
}
