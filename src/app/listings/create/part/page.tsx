"use client"
export const dynamic = "force-dynamic"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Box, Stack, Text, Paper, TextInput, Textarea, Select, NumberInput, Button, Group, Container, Loader, Center, ThemeIcon, Divider, Badge } from "@mantine/core"
import { IconPlus, IconCheck, IconCar, IconTrash } from "@tabler/icons-react"
import { notifications } from "@mantine/notifications"
import { PART_TYPES, PART_SUBCATEGORIES, CONDITIONS } from "@/lib/constants"
import { POPULAR_BRANDS, getModels } from "@/lib/catalog"

export default function CreatePartPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [f, setF] = useState({
    name: "", description: "", price: "", condition: "NEW", partType: "ENGINE",
    make: "", model: "", location: "Москва", subcategory: "", oemNumber: "",
  })
  const [compat, setCompat] = useState<{ make: string; model: string; yearFrom: string; yearTo: string }[]>([])
  const [newCompat, setNewCompat] = useState({ make: "", model: "", yearFrom: "", yearTo: "" })

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin")
  }, [status, router])

  if (status === "loading") return <Center py={100}><Loader color="indigo" /></Center>
  if (!session) return null

  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))
  const subcats = f.partType ? PART_SUBCATEGORIES[f.partType] || [] : []

  const addCompat = () => {
    if (!newCompat.make) return
    setCompat([...compat, { ...newCompat }])
    setNewCompat({ make: "", model: "", yearFrom: "", yearTo: "" })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!f.name || !f.price) {
      notifications.show({ title: "Ошибка", message: "Заполните название и цену", color: "red" })
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/parts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: f.name, description: f.description, price: Number(f.price),
          condition: f.condition, partType: f.partType,
          make: f.make || compat[0]?.make || "Universal", model: f.model || compat[0]?.model || "Universal",
          yearFrom: compat[0]?.yearFrom ? Number(compat[0].yearFrom) : null,
          yearTo: compat[0]?.yearTo ? Number(compat[0].yearTo) : null,
          location: f.location, subcategory: f.subcategory, oemNumber: f.oemNumber,
          compatibility: compat.map(c => ({ make: c.make, model: c.model, yearFrom: c.yearFrom ? Number(c.yearFrom) : null, yearTo: c.yearTo ? Number(c.yearTo) : null })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Ошибка")
      notifications.show({ title: "Готово!", message: "Запчасть опубликована", color: "green" })
      router.push(`/listings/part/${data.id}`)
    } catch (err: any) {
      notifications.show({ title: "Ошибка", message: err.message, color: "red" })
    } finally { setLoading(false) }
  }

  return (
    <Container size="md" py="lg">
      <Stack gap="md">
        <Group gap="sm" align="center">
          <ThemeIcon variant="light" color="green" size={44} radius="md"><IconPlus size={22} /></ThemeIcon>
          <Stack gap={0}>
            <Text component="h1" fw={800} fz={22} c="dark.9" ff="var(--font-display),sans-serif">Продать запчасть</Text>
            <Text size="xs" c="gray.5">Укажите совместимость — больше продаж</Text>
          </Stack>
        </Group>

        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <Paper radius="md" p="md" withBorder>
              <Stack gap="sm">
                <Text fw={700} fz="sm" c="dark.9">Информация о запчасти</Text>
                <TextInput label="Название" placeholder="Колодки тормозные передние" required value={f.name} onChange={(e) => set("name", e.target.value)} size="sm" />
                <Group gap="sm" grow>
                  <Select label="Категория" data={PART_TYPES.map(t => ({ value: t.value, label: t.label }))} value={f.partType} onChange={(v) => { set("partType", v || ""); set("subcategory", "") }} size="sm" />
                  {subcats.length > 0 && <Select label="Подкатегория" data={subcats.map(s => ({ value: s, label: s }))} value={f.subcategory} onChange={(v) => set("subcategory", v || "")} size="sm" />}
                </Group>
                <Group gap="sm" grow>
                  <NumberInput label="Цена, ₽" placeholder="4500" required value={f.price ? Number(f.price) : undefined} onChange={(v) => set("price", String(v || ""))} size="sm" min={0} />
                  <Select label="Состояние" data={CONDITIONS.map(c => ({ value: c.value, label: c.label }))} value={f.condition} onChange={(v) => set("condition", v || "")} size="sm" />
                  <TextInput label="OEM номер" placeholder="04465-0E040" value={f.oemNumber} onChange={(e) => set("oemNumber", e.target.value)} size="sm" />
                </Group>
                <Textarea label="Описание" placeholder="Состояние, комплектация, гарантия..." value={f.description} onChange={(e) => set("description", e.target.value)} size="sm" minRows={3} />
                <TextInput label="Город" value={f.location} onChange={(e) => set("location", e.target.value)} size="sm" />
              </Stack>
            </Paper>

            <Paper radius="md" p="md" withBorder>
              <Stack gap="sm">
                <Group gap="sm" align="center">
                  <IconCar size={18} color="#4f46e5" />
                  <Text fw={700} fz="sm" c="dark.9">Совместимость (на какие авто подходит)</Text>
                </Group>
                {compat.length > 0 && (
                  <Group gap="xs" wrap="wrap">
                    {compat.map((c, i) => (
                      <Badge key={i} size="md" variant="light" color="blue" rightSection={<button onClick={() => setCompat(compat.filter((_, idx) => idx !== i))} style={{ border: "none", background: "transparent", cursor: "pointer" }}><IconTrash size={10} /></button>}>
                        {c.make} {c.model} {c.yearFrom ? `${c.yearFrom}-${c.yearTo || ""}` : ""}
                      </Badge>
                    ))}
                  </Group>
                )}
                <Divider />
                <Group gap="sm" grow align="flex-end">
                  <Select placeholder="Марка" data={POPULAR_BRANDS.slice(0, 60).map(b => ({ value: b.name, label: b.name }))} searchable value={newCompat.make} onChange={(v) => setNewCompat({ ...newCompat, make: v || "" })} size="xs" />
                  <Select placeholder="Модель" data={newCompat.make ? getModels(newCompat.make).map(m => ({ value: m, label: m })) : []} searchable value={newCompat.model} onChange={(v) => setNewCompat({ ...newCompat, model: v || "" })} size="xs" />
                  <TextInput placeholder="Год от" value={newCompat.yearFrom} onChange={(e) => setNewCompat({ ...newCompat, yearFrom: e.target.value })} size="xs" type="number" />
                  <TextInput placeholder="Год до" value={newCompat.yearTo} onChange={(e) => setNewCompat({ ...newCompat, yearTo: e.target.value })} size="xs" type="number" />
                  <Button variant="light" color="indigo" size="xs" onClick={addCompat} leftSection={<IconPlus size={14} />}>Добавить</Button>
                </Group>
                <Text size="xs" c="gray.5">Добавьте все совместимые авто — запчасть найдут больше покупателей</Text>
              </Stack>
            </Paper>

            <Button type="submit" size="lg" radius="md" color="green" loading={loading} leftSection={<IconCheck size={18} />}>
              {loading ? "Публикация..." : "Опубликовать запчасть"}
            </Button>
          </Stack>
        </form>
      </Stack>
    </Container>
  )
}
