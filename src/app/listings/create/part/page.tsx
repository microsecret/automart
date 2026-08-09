"use client"
export const dynamic = "force-dynamic"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Box, Stack, Text, Paper, TextInput, Textarea, Select, NumberInput, Button, Group, Container, Loader, Center, ThemeIcon, Divider, Badge, FileInput, ActionIcon, SimpleGrid } from "@mantine/core"
import { IconPlus, IconCheck, IconCar, IconTrash, IconPhoto, IconX } from "@tabler/icons-react"
import { notifications } from "@mantine/notifications"
import { PART_TYPES, PART_SUBCATEGORIES, PART_CONDITIONS, SELLER_TYPES, AVAILABILITY_TYPES } from "@/lib/constants"
import { getBrandsByCategory, getModels } from "@/lib/catalog"

export default function CreatePartPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [f, setF] = useState({
    name: "", description: "", price: "", condition: "NEW", partType: "ENGINE",
    make: "", model: "", location: "Москва", subcategory: "", oemNumber: "", sellerType: "OWNER", availability: "IN_STOCK",
    saleFormat: "FIXED", auctionEndsAt: "", auctionStartPrice: "", auctionMinStep: "",
  })
  const [compat, setCompat] = useState<{ make: string; model: string; generation: string; engine: string; yearFrom: string; yearTo: string }[]>([])
  const [newCompat, setNewCompat] = useState({ make: "", model: "", generation: "", engine: "", yearFrom: "", yearTo: "" })
  const [images, setImages] = useState<string[]>([])
  const [uploadingImages, setUploadingImages] = useState(false)

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
    setNewCompat({ make: "", model: "", generation: "", engine: "", yearFrom: "", yearTo: "" })
  }

  const uploadPhotos = async (files: File[] | null) => {
    const selected = Array.isArray(files) ? files : []
    if (selected.length === 0) return
    const freeSlots = Math.max(0, 12 - images.length)
    if (freeSlots === 0) {
      notifications.show({ title: "Лимит фотографий", message: "В объявление можно добавить до 12 фотографий.", color: "orange" })
      return
    }
    setUploadingImages(true)
    try {
      const urls = await Promise.all(selected.slice(0, freeSlots).map(async (file) => {
        const formData = new FormData()
        formData.append("file", file)
        const response = await fetch("/api/upload", { method: "POST", body: formData })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || "Не удалось загрузить фотографию")
        return result.url as string
      }))
      setImages((current) => [...current, ...urls])
      if (selected.length > freeSlots) notifications.show({ title: "Добавлены не все фото", message: `Добавлено ${freeSlots} из ${selected.length}: лимит 12.`, color: "orange" })
    } catch (error: any) {
      notifications.show({ title: "Не удалось загрузить фото", message: error.message || "Повторите попытку.", color: "red" })
    } finally {
      setUploadingImages(false)
    }
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
          images: images.length > 0 ? JSON.stringify(images) : null,
          compatibility: compat.map(c => ({ make: c.make, model: c.model, generation: c.generation || null, engine: c.engine || null, yearFrom: c.yearFrom ? Number(c.yearFrom) : null, yearTo: c.yearTo ? Number(c.yearTo) : null })),
          sellerType: f.sellerType,
          availability: f.availability,
          saleFormat: f.saleFormat,
          auctionEndsAt: f.auctionEndsAt || null,
          auctionStartPrice: f.auctionStartPrice ? Number(f.auctionStartPrice) : null,
          auctionMinStep: f.auctionMinStep ? Number(f.auctionMinStep) : null,
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
                  <Select label="Состояние" data={PART_CONDITIONS.map(c => ({ value: c.value, label: c.label }))} value={f.condition} onChange={(v) => set("condition", v || "")} size="sm" />
                  <TextInput label="OEM номер" placeholder="04465-0E040" value={f.oemNumber} onChange={(e) => set("oemNumber", e.target.value)} size="sm" />
                </Group>
                <Group gap="sm" grow>
                  <Select label="Формат продажи" data={[{ value: "FIXED", label: "Фиксированная цена" }, { value: "AUCTION", label: "Аукцион" }]} value={f.saleFormat} onChange={(v) => set("saleFormat", v || "FIXED")} size="sm" />
                  <Select label="Продавец" data={SELLER_TYPES.map(t => ({ value: t.value, label: t.label }))} value={f.sellerType} onChange={(v) => set("sellerType", v || "OWNER")} size="sm" />
                  <Select label="Наличие" data={AVAILABILITY_TYPES.map(t => ({ value: t.value, label: t.label }))} value={f.availability} onChange={(v) => set("availability", v || "IN_STOCK")} size="sm" />
                </Group>
                {f.saleFormat === "AUCTION" && (
                  <Group gap="sm" grow>
                    <TextInput label="Окончание аукциона" type="datetime-local" required value={f.auctionEndsAt} onChange={(e) => set("auctionEndsAt", e.target.value)} size="sm" />
                    <NumberInput label="Стартовая цена, ₽" value={f.auctionStartPrice ? Number(f.auctionStartPrice) : undefined} onChange={(v) => set("auctionStartPrice", String(v || ""))} size="sm" min={1} />
                    <NumberInput label="Шаг ставки, ₽" value={f.auctionMinStep ? Number(f.auctionMinStep) : undefined} onChange={(v) => set("auctionMinStep", String(v || ""))} size="sm" min={1} />
                  </Group>
                )}
                <Textarea label="Описание" placeholder="Состояние, комплектация, гарантия..." value={f.description} onChange={(e) => set("description", e.target.value)} size="sm" minRows={3} />
                <TextInput label="Город" value={f.location} onChange={(e) => set("location", e.target.value)} size="sm" />
              </Stack>
            </Paper>

            <Paper radius="md" p="md" withBorder>
              <Stack gap="sm">
                <Group justify="space-between" align="center">
                  <Group gap="sm"><ThemeIcon variant="light" color="indigo" size={32} radius="md"><IconPhoto size={18} /></ThemeIcon><Stack gap={0}><Text fw={700} fz="sm" c="dark.9">Фотографии товара</Text><Text size="xs" c="gray.5">Первое фото станет обложкой объявления. До 12 JPG, PNG или WebP.</Text></Stack></Group>
                  <Badge variant="light" color={images.length ? "indigo" : "gray"}>{images.length}/12</Badge>
                </Group>
                <FileInput accept="image/jpeg,image/png,image/webp" multiple clearable disabled={uploadingImages || images.length >= 12} placeholder="Выберите фотографии" onChange={uploadPhotos} leftSection={<IconPhoto size={16} />} />
                {uploadingImages && <Text size="xs" c="indigo">Загружаем фотографии…</Text>}
                {images.length > 0 && <SimpleGrid cols={{ base: 3, sm: 4, md: 6 }} spacing="xs">
                  {images.map((image, index) => <Box key={image} pos="relative" style={{ aspectRatio: "1", overflow: "hidden", borderRadius: 10, border: index === 0 ? "2px solid var(--mantine-color-indigo-5)" : "1px solid var(--mantine-color-gray-3)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}<img src={image} alt={`Фото ${index + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <ActionIcon aria-label={`Удалить фото ${index + 1}`} type="button" size="sm" color="dark" variant="filled" pos="absolute" top={5} right={5} onClick={() => setImages((current) => current.filter((_, imageIndex) => imageIndex !== index))}><IconX size={13} /></ActionIcon>
                    {index === 0 && <Badge size="xs" color="indigo" variant="filled" pos="absolute" left={5} bottom={5}>Обложка</Badge>}
                  </Box>)}
                </SimpleGrid>}
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
                      <Badge key={i} size="md" variant="light" color="blue" rightSection={<button type="button" aria-label={`Убрать ${c.make} ${c.model}`} onClick={() => setCompat(compat.filter((_, idx) => idx !== i))} style={{ border: "none", background: "transparent", cursor: "pointer" }}><IconTrash size={10} /></button>}>
                        {c.make} {c.model} {c.generation ? `· ${c.generation}` : ""} {c.yearFrom ? `${c.yearFrom}-${c.yearTo || ""}` : ""}
                      </Badge>
                    ))}
                  </Group>
                )}
                <Divider />
                <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="xs">
                  <Select label="Марка" placeholder="Выберите марку" data={getBrandsByCategory("cars").map(b => ({ value: b.name, label: b.name }))} searchable value={newCompat.make} onChange={(v) => setNewCompat({ ...newCompat, make: v || "", model: "", generation: "", engine: "" })} size="xs" />
                  <Select label="Модель" placeholder={newCompat.make ? "Любая модель" : "Сначала марка"} data={newCompat.make ? getModels(newCompat.make, "cars").map(m => ({ value: m, label: m })) : []} searchable disabled={!newCompat.make} value={newCompat.model} onChange={(v) => setNewCompat({ ...newCompat, model: v || "" })} size="xs" />
                  <TextInput label="Поколение" placeholder="Например, XV40" value={newCompat.generation} onChange={(e) => setNewCompat({ ...newCompat, generation: e.target.value })} size="xs" />
                  <TextInput label="Двигатель" placeholder="2.0 / 1GR-FE" value={newCompat.engine} onChange={(e) => setNewCompat({ ...newCompat, engine: e.target.value })} size="xs" />
                  <TextInput label="Год от" placeholder="2012" value={newCompat.yearFrom} onChange={(e) => setNewCompat({ ...newCompat, yearFrom: e.target.value })} size="xs" type="number" />
                  <TextInput label="Год до" placeholder="2020" value={newCompat.yearTo} onChange={(e) => setNewCompat({ ...newCompat, yearTo: e.target.value })} size="xs" type="number" />
                </SimpleGrid>
                <Group justify="flex-end"><Button type="button" variant="light" color="indigo" size="sm" onClick={addCompat} leftSection={<IconPlus size={14} />}>Добавить автомобиль</Button></Group>
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
