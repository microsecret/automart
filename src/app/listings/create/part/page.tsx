"use client"
export const dynamic = "force-dynamic"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Box, Stack, Text, Paper, TextInput, Textarea, Select, NumberInput, Button, Group, Container, Loader, Center, ThemeIcon, Divider, Badge, FileInput, ActionIcon, SimpleGrid, SegmentedControl, Image } from "@mantine/core"
import { IconPlus, IconCheck, IconCar, IconTrash, IconPhoto, IconX } from "@tabler/icons-react"
import { notifications } from "@mantine/notifications"
import { PART_TYPES, PART_SUBCATEGORIES, PART_CONDITIONS, SELLER_TYPES, PART_AVAILABILITY_TYPES } from "@/lib/constants"
import { getBrandsByCategory, getModels } from "@/lib/catalog"
import { useMarketplaceImageUpload } from "@/hooks/useMarketplaceImageUpload"
import { fetchJson } from "@/lib/api-client"
import styles from "../listing-create-form.module.css"

type CreatedPartResponse = { id: string }

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
  const { images, uploadingImages, uploadPhotos, removeImage } = useMarketplaceImageUpload()

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin")
  }, [status, router])

  if (status === "loading") return <Center py={100}><Loader color="indigo" /></Center>
  if (!session) return null

  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))
  const subcats = f.partType ? PART_SUBCATEGORIES[f.partType] || [] : []
  const isPartDetailsReady = Boolean(f.name.trim() && f.price)
  const currentJourneyStep = images.length > 0 ? 2 : isPartDetailsReady ? 1 : 0

  const addCompat = () => {
    if (!newCompat.make) return
    setCompat([...compat, { ...newCompat }])
    setNewCompat({ make: "", model: "", generation: "", engine: "", yearFrom: "", yearTo: "" })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!f.name || !f.price) {
      notifications.show({ title: "Ошибка", message: "Заполните название и цену", color: "red" })
      return
    }
    setLoading(true)
    try {
      const data = await fetchJson<CreatedPartResponse>("/api/parts", {
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
      notifications.show({ title: "Отправлено на проверку", message: "Мы проверим карточку и опубликуем её после модерации.", color: "indigo" })
      router.push(`/listings/part/${data.id}`)
    } catch (err) {
      notifications.show({ title: "Ошибка", message: err instanceof Error ? err.message : "Не удалось отправить объявление", color: "red" })
    } finally { setLoading(false) }
  }

  return (
    <Container className="create-listing-page" size="md" py="lg">
      <Stack gap="md">
        <Group gap="sm" align="center">
          <ThemeIcon variant="light" color="indigo" size={44} radius="md"><IconPlus size={22} /></ThemeIcon>
          <Stack gap={0}>
            <Text component="h1" fw={800} fz={22} c="var(--market-ink)" ff="var(--font-display),sans-serif">Продать запчасть</Text>
            <Text size="xs" c="var(--market-muted)">Заполните карточку — после проверки она появится в каталоге запчастей.</Text>
          </Stack>
        </Group>

        <Paper className="create-listing__journey" radius="lg" p="sm" withBorder>
          <SimpleGrid cols={{ base: 1, xs: 3 }} spacing={0}>
            {[
              { number: "01", label: "Данные товара", description: f.partType ? PART_TYPES.find((type) => type.value === f.partType)?.label || "Запчасть" : "Запчасть" },
              { number: "02", label: "Совместимость", description: compat.length ? `Добавлено авто: ${compat.length}` : isPartDetailsReady ? "Основные данные готовы" : "Укажите подходящие модели" },
              { number: "03", label: "Фото и публикация", description: images.length ? `Добавлено фото: ${images.length}` : "Добавьте реальные фотографии" },
            ].map((step, index) => (
              <Group
                className="create-listing__journey-step"
                data-current={index === currentJourneyStep || undefined}
                data-complete={index < currentJourneyStep || undefined}
                gap="sm"
                key={step.number}
                wrap="nowrap"
              >
                <Text className="create-listing__journey-number">{step.number}</Text>
                <Stack gap={1}>
                  <Text size="xs" fw={800} c="var(--market-ink)">{step.label}</Text>
                  <Text size="11px" c="dimmed">{step.description}</Text>
                </Stack>
              </Group>
            ))}
          </SimpleGrid>
        </Paper>

        <form onSubmit={handleSubmit}>
          <Stack className={`${styles.listingCreateForm} create-listing__form`} gap="md">
            <Paper className="create-listing__section" data-accent="indigo" radius="lg" p="md" withBorder>
              <Stack gap="sm">
                <Group justify="space-between" align="flex-start">
                  <Stack gap={1}>
                    <Text fw={700} fz="sm" c="var(--market-ink)">Информация о запчасти</Text>
                    <Text size="xs" c="dimmed">Понятная карточка с артикулом, ценой и способом покупки.</Text>
                  </Stack>
                  <Badge size="sm" color="indigo" variant="light">Шаг 1</Badge>
                </Group>
                <TextInput label="Название" placeholder="Колодки тормозные передние" required value={f.name} onChange={(e) => set("name", e.target.value)} size="sm" />
                <Group gap="sm" grow>
                  <Select label="Категория" data={PART_TYPES.map(t => ({ value: t.value, label: t.label }))} value={f.partType} onChange={(v) => { set("partType", v || ""); set("subcategory", "") }} size="sm" />
                  {subcats.length > 0 && <Select label="Подкатегория" data={subcats.map(s => ({ value: s, label: s }))} value={f.subcategory} onChange={(v) => set("subcategory", v || "")} size="sm" />}
                </Group>
                <Group gap="sm" grow>
                  <NumberInput label="Цена, ₽" placeholder="4500" required value={f.price ? Number(f.price) : undefined} onChange={(v) => set("price", String(v || ""))} size="sm" min={0} />
                  <TextInput label="OEM номер" placeholder="04465-0E040" value={f.oemNumber} onChange={(e) => set("oemNumber", e.target.value)} size="sm" />
                </Group>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  <Stack gap={6}>
                    <Text size="xs" fw={700} c="var(--market-ink)">Состояние</Text>
                    <SegmentedControl aria-label="Состояние запчасти" value={f.condition} onChange={(value) => set("condition", value)} data={PART_CONDITIONS.map(({ value, label }) => ({ value, label }))} size="sm" radius="md" fullWidth />
                  </Stack>
                  <Stack gap={6}>
                    <Text size="xs" fw={700} c="var(--market-ink)">Наличие</Text>
                    <SegmentedControl aria-label="Наличие запчасти" value={f.availability} onChange={(value) => set("availability", value)} data={PART_AVAILABILITY_TYPES.map(({ value, label }) => ({ value, label }))} size="sm" radius="md" fullWidth />
                  </Stack>
                </SimpleGrid>
                <Group gap="sm" grow>
                  <Stack gap={6}>
                    <Text size="xs" fw={700} c="var(--market-ink)">Формат сделки</Text>
                    <SegmentedControl aria-label="Формат сделки" value={f.saleFormat} onChange={(value) => set("saleFormat", value)} data={[{ value: "FIXED", label: "Фикс. цена" }, { value: "AUCTION", label: "Аукцион" }]} size="sm" radius="md" fullWidth />
                  </Stack>
                  <Select label="Продавец" data={SELLER_TYPES.map(t => ({ value: t.value, label: t.label }))} value={f.sellerType} onChange={(v) => set("sellerType", v || "OWNER")} size="sm" />
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

            <Paper className="create-listing__section" data-accent="indigo" radius="lg" p="md" withBorder>
              <Stack gap="sm">
                <Group justify="space-between" align="center">
                  <Group gap="sm"><ThemeIcon variant="light" color="indigo" size={32} radius="md"><IconPhoto size={18} /></ThemeIcon><Stack gap={0}><Text fw={700} fz="sm" c="var(--market-ink)">Фотографии товара</Text><Text size="xs" c="var(--market-muted)">Первое фото станет обложкой объявления. До 12 JPG, PNG или WebP.</Text></Stack></Group>
                  <Badge variant="light" color={images.length ? "indigo" : "gray"}>{images.length}/12</Badge>
                </Group>
                <FileInput accept="image/jpeg,image/png,image/webp" multiple clearable disabled={uploadingImages || images.length >= 12} placeholder="Выберите фотографии" onChange={uploadPhotos} leftSection={<IconPhoto size={16} />} />
                {uploadingImages && <Text size="xs" c="indigo">Загружаем фотографии…</Text>}
                {images.length > 0 && <SimpleGrid cols={{ base: 3, sm: 4, md: 6 }} spacing="xs">
                  {images.map((image, index) => <Box key={image} pos="relative" style={{ aspectRatio: "1", overflow: "hidden", borderRadius: 10, border: index === 0 ? "2px solid var(--mantine-color-indigo-5)" : "1px solid var(--mantine-color-gray-3)" }}>
                    <Image src={image} alt={`Фото ${index + 1}`} w="100%" h="100%" fit="cover" />
                    <ActionIcon aria-label={`Удалить фото ${index + 1}`} type="button" size="sm" color="dark" variant="filled" pos="absolute" top={5} right={5} onClick={() => removeImage(index)}><IconX size={13} /></ActionIcon>
                    {index === 0 && <Badge size="xs" color="indigo" variant="filled" pos="absolute" left={5} bottom={5}>Обложка</Badge>}
                  </Box>)}
                </SimpleGrid>}
              </Stack>
            </Paper>

            <Paper className="create-listing__section" radius="lg" p="md" withBorder>
              <Stack gap="sm">
                <Group justify="space-between" align="center">
                  <Group gap="sm" align="center">
                    <ThemeIcon variant="light" color="indigo" size={32} radius="md"><IconCar size={18} /></ThemeIcon>
                    <Stack gap={0}>
                      <Text fw={700} fz="sm" c="var(--market-ink)">Совместимость с автомобилями</Text>
                      <Text size="xs" c="dimmed">Укажите модели — покупатели увидят деталь при подборе.</Text>
                    </Stack>
                  </Group>
                  <Badge size="sm" color={compat.length ? "indigo" : "gray"} variant="light">{compat.length} авто</Badge>
                </Group>
                {compat.length > 0 && (
                  <Group gap="xs" wrap="wrap">
                    {compat.map((c, i) => (
                      <Badge key={i} size="md" variant="light" color="blue" rightSection={<ActionIcon type="button" aria-label={`Убрать ${c.make} ${c.model}`} onClick={() => setCompat(compat.filter((_, idx) => idx !== i))} size="xs" variant="transparent" color="blue"><IconTrash size={11} /></ActionIcon>}>
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
                <Text size="xs" c="var(--market-muted)">Добавьте все совместимые авто — запчасть найдут больше покупателей</Text>
              </Stack>
            </Paper>

            <Paper className={styles.submitPanel} radius="lg" p="sm" withBorder>
              <Stack gap={6}>
                <Button fullWidth type="submit" size="md" radius="md" color="indigo" loading={loading} disabled={uploadingImages} leftSection={<IconCheck size={18} />}>
                  {loading ? "Публикация..." : "Отправить на модерацию"}
                </Button>
                <Text size="xs" c="dimmed" ta="center">Сначала объявление проверит модератор. Статус появится в личном кабинете.</Text>
              </Stack>
            </Paper>
          </Stack>
        </form>
      </Stack>
    </Container>
  )
}
