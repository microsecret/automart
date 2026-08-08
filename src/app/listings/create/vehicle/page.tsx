"use client"
export const dynamic = "force-dynamic"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Box, Stack, Text, Paper, TextInput, Textarea, Select, NumberInput, Button, Group, Divider, Container, Loader, Center, SegmentedControl, ThemeIcon, Notifications } from "@mantine/core"
import { IconCar, IconCheck, IconPlus } from "@tabler/icons-react"
import { notifications } from "@mantine/notifications"
import { POPULAR_BRANDS, getModels } from "@/lib/catalog"
import { BODY_TYPES, FUEL_TYPES, TRANSMISSIONS, DRIVE_TYPES, CONDITIONS, STEERING_WHEELS, DOCUMENT_STATUSES, DAMAGE_INFO, SELLER_TYPES, AVAILABILITY_TYPES } from "@/lib/constants"

const CATS = [
  { value: "CAR", label: "Легковые" },
  { value: "MOTORCYCLE", label: "Мото" },
  { value: "TRUCK", label: "Грузовики" },
  { value: "SPECIAL", label: "Спецтехника" },
  { value: "WATER", label: "Водный транспорт" },
  { value: "AIR", label: "Авиа" },
]

export default function CreateVehiclePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [catId, setCatId] = useState("")

  const [f, setF] = useState({
    title: "", make: "", model: "", year: "", price: "", mileage: "",
    vin: "", fuelType: "GASOLINE", transmission: "AUTOMATIC", bodyType: "SEDAN",
    color: "", doors: "", engineVolume: "", power: "", driveType: "FWD",
    condition: "EXCELLENT", location: "", description: "",
    vehicleType: "CAR",
    steeringWheel: "LEFT", ownersCount: "", documentsStatus: "CLEAN",
    damageInfo: "NONE", sellerType: "OWNER", availability: "IN_STOCK",
    customsCleared: "true", generation: "", keywords: "",
  })

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin")
  }, [status, router])

  useEffect(() => {
    fetch("/api/categories").then(r => r.json()).then(d => {
      if (d.categories?.[0]) setCatId(d.categories[0].id)
    }).catch(() => {})
  }, [])

  if (status === "loading") return <Center py={100}><Loader color="indigo" /></Center>
  if (!session) return null

  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!f.make || !f.model || !f.year || !f.price) {
      notifications.show({ title: "Ошибка", message: "Заполните обязательные поля", color: "red" })
      return
    }
    setLoading(true)
    try {
      // 1. Создать vehicle
      const vehRes = await fetch("/api/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          make: f.make, model: f.model, year: Number(f.year), price: Number(f.price),
          mileage: f.mileage ? Number(f.mileage) : 0,
          vin: f.vin || `TEMP${Date.now()}`,
          fuelType: f.fuelType, transmission: f.transmission, bodyType: f.bodyType,
          color: f.color || null, doors: f.doors ? Number(f.doors) : null,
          engineVolume: f.engineVolume ? parseFloat(f.engineVolume) : null,
          power: f.power ? Number(f.power) : null, driveType: f.driveType,
          condition: f.condition, location: f.location || "Москва",
          description: f.description, images: null,
          steeringWheel: f.steeringWheel, ownersCount: f.ownersCount || null,
          documentsStatus: f.documentsStatus, damageInfo: f.damageInfo,
          sellerType: f.sellerType, availability: f.availability,
          customsCleared: f.customsCleared === "true",
          generation: f.generation, keywords: f.keywords,
          categoryId: catId,
        }),
      })
      const veh = await vehRes.json()
      if (!vehRes.ok) throw new Error(veh.error || "Ошибка создания ТС")

      // 2. Создать listing
      const listRes = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: f.title || `${f.year} ${f.make} ${f.model}`,
          description: f.description, price: Number(f.price), vehicleId: veh.id,
        }),
      })
      const list = await listRes.json()
      if (!listRes.ok) throw new Error(list.error || "Ошибка создания объявления")

      notifications.show({ title: "Готово!", message: "Объявление опубликовано", color: "green" })
      router.push(`/listings/vehicle/${veh.id}`)
    } catch (err: any) {
      notifications.show({ title: "Ошибка", message: err.message, color: "red" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container size="md" py="lg">
      <Stack gap="md">
        <Group gap="sm" align="center">
          <ThemeIcon variant="light" color="indigo" size={44} radius="md"><IconPlus size={22} /></ThemeIcon>
          <Stack gap={0}>
            <Text component="h1" fw={800} fz={22} c="dark.9" ff="var(--font-display),sans-serif">Новое объявление</Text>
            <Text size="xs" c="gray.5">Заполните данные — объявление появится в поиске сразу</Text>
          </Stack>
        </Group>

        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            {/* Тип транспорта */}
            <Paper radius="md" p="md" withBorder>
              <Text fw={700} fz="sm" c="dark.9" mb="sm">Тип транспорта</Text>
              <SegmentedControl value={f.vehicleType} onChange={(v) => set("vehicleType", v)} data={CATS} size="sm" radius="md" fullWidth />
            </Paper>

            {/* Основное */}
            <Paper radius="md" p="md" withBorder>
              <Stack gap="sm">
                <Text fw={700} fz="sm" c="dark.9">Основная информация</Text>
                <TextInput label="Заголовок" placeholder="2018 Toyota Camry" required value={f.title} onChange={(e) => set("title", e.target.value)} size="sm" />
                <Group gap="sm" grow>
                  <TextInput label="Марка" placeholder="Toyota" required value={f.make} onChange={(e) => set("make", e.target.value)} size="sm" list="brands" />
                  <TextInput label="Модель" placeholder="Camry" required value={f.model} onChange={(e) => set("model", e.target.value)} size="sm" />
                </Group>
                <Group gap="sm" grow>
                  <NumberInput label="Год" placeholder="2018" required value={f.year ? Number(f.year) : undefined} onChange={(v) => set("year", String(v || ""))} size="sm" min={1980} max={2026} />
                  <NumberInput label="Цена, ₽" placeholder="1500000" required value={f.price ? Number(f.price) : undefined} onChange={(v) => set("price", String(v || ""))} size="sm" min={0} thousandGroup />
                  <NumberInput label="Пробег, км" placeholder="120000" value={f.mileage ? Number(f.mileage) : undefined} onChange={(v) => set("mileage", String(v || ""))} size="sm" min={0} thousandGroup />
                </Group>
                <Group gap="sm" grow>
                  <TextInput label="Город" placeholder="Москва" value={f.location} onChange={(e) => set("location", e.target.value)} size="sm" />
                  <TextInput label="VIN" placeholder="17 символов" value={f.vin} onChange={(e) => set("vin", e.target.value)} size="sm" maxLength={17} />
                </Group>
              </Stack>
            </Paper>

            {/* Характеристики */}
            <Paper radius="md" p="md" withBorder>
              <Stack gap="sm">
                <Text fw={700} fz="sm" c="dark.9">Характеристики</Text>
                <Group gap="sm" grow>
                  <Select label="Топливо" data={FUEL_TYPES.map(t => ({ value: t.value, label: t.label }))} value={f.fuelType} onChange={(v) => set("fuelType", v || "")} size="sm" />
                  <Select label="КПП" data={TRANSMISSIONS.map(t => ({ value: t.value, label: t.label }))} value={f.transmission} onChange={(v) => set("transmission", v || "")} size="sm" />
                  <Select label="Привод" data={DRIVE_TYPES.map(t => ({ value: t.value, label: t.label }))} value={f.driveType} onChange={(v) => set("driveType", v || "")} size="sm" />
                </Group>
                {f.vehicleType === "CAR" && (
                  <Select label="Тип кузова" data={BODY_TYPES.map(t => ({ value: t.value, label: t.label }))} value={f.bodyType} onChange={(v) => set("bodyType", v || "")} size="sm" />
                )}
                <Group gap="sm" grow>
                  <TextInput label="Объём двигателя, л" placeholder="2.0" value={f.engineVolume} onChange={(e) => set("engineVolume", e.target.value)} size="sm" type="number" step="0.1" />
                  <TextInput label="Мощность, л.с." placeholder="150" value={f.power} onChange={(e) => set("power", e.target.value)} size="sm" type="number" />
                  <TextInput label="Цвет" placeholder="Белый" value={f.color} onChange={(e) => set("color", e.target.value)} size="sm" />
                </Group>
                <Group gap="sm" grow>
                  <Select label="Состояние" data={CONDITIONS.map(t => ({ value: t.value, label: t.label }))} value={f.condition} onChange={(v) => set("condition", v || "")} size="sm" />
                  <Select label="Руль" data={STEERING_WHEELS.map(t => ({ value: t.value, label: t.label }))} value={f.steeringWheel} onChange={(v) => set("steeringWheel", v || "")} size="sm" />
                </Group>
              </Stack>
            </Paper>

            {/* Документы и состояние */}
            <Paper radius="md" p="md" withBorder>
              <Stack gap="sm">
                <Text fw={700} fz="sm" c="dark.9">Документы и состояние</Text>
                <Group gap="sm" grow>
                  <Select label="Документы" data={DOCUMENT_STATUSES.map(t => ({ value: t.value, label: t.label }))} value={f.documentsStatus} onChange={(v) => set("documentsStatus", v || "")} size="sm" />
                  <Select label="Повреждения" data={DAMAGE_INFO.map(t => ({ value: t.value, label: t.label }))} value={f.damageInfo} onChange={(v) => set("damageInfo", v || "")} size="sm" />
                </Group>
                <Group gap="sm" grow>
                  <NumberInput label="Владельцев" placeholder="2" value={f.ownersCount ? Number(f.ownersCount) : undefined} onChange={(v) => set("ownersCount", String(v || ""))} size="sm" min={1} max={10} />
                  <Select label="Продавец" data={SELLER_TYPES.map(t => ({ value: t.value, label: t.label }))} value={f.sellerType} onChange={(v) => set("sellerType", v || "")} size="sm" />
                  <Select label="Наличие" data={AVAILABILITY_TYPES.map(t => ({ value: t.value, label: t.label }))} value={f.availability} onChange={(v) => set("availability", v || "")} size="sm" />
                </Group>
                <Group gap="sm" grow>
                  <Select label="Растаможен" data={[{ value: "true", label: "Да" }, { value: "false", label: "Нет" }]} value={f.customsCleared} onChange={(v) => set("customsCleared", v || "true")} size="sm" />
                  <TextInput label="Поколение" placeholder="VII (XV50)" value={f.generation} onChange={(e) => set("generation", e.target.value)} size="sm" />
                </Group>
              </Stack>
            </Paper>

            {/* Описание */}
            <Paper radius="md" p="md" withBorder>
              <Stack gap="sm">
                <Text fw={700} fz="sm" c="dark.9">Описание</Text>
                <Textarea label="Подробное описание" placeholder="Опишите состояние, историю, комплектацию..." value={f.description} onChange={(e) => set("description", e.target.value)} size="sm" minRows={4} autosize />
                <TextInput label="Ключевые слова" placeholder='"один хозяин", ксенон, панорама...' value={f.keywords} onChange={(e) => set("keywords", e.target.value)} size="sm" />
                <Text size="xs" c="gray.5">Ключевые слова помогают найти ваше объявление</Text>
              </Stack>
            </Paper>

            {/* Кнопка */}
            <Button type="submit" size="lg" radius="md" color="indigo" loading={loading} leftSection={<IconCheck size={18} />}>
              {loading ? "Публикация..." : "Опубликовать объявление"}
            </Button>
          </Stack>
        </form>
      </Stack>
    </Container>
  )
}
