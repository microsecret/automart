"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Alert, Badge, Box, Button, Card, Container, Group, NumberInput, Select, SimpleGrid,
  Stack, Text, TextInput, Textarea, ThemeIcon, Title,
} from "@mantine/core"
import { IconBolt, IconCheck, IconPhoto } from "@tabler/icons-react"
import { getApiClientErrorMessage } from "@/lib/api-client"

const VEHICLE_TYPES = [
  { value: "CAR", label: "Легковой" },
  { value: "MOTORCYCLE", label: "Мото" },
  { value: "TRUCK", label: "Грузовик" },
  { value: "SPECIAL", label: "Спецтехника" },
  { value: "WATER", label: "Водный транспорт" },
  { value: "AIR", label: "Воздушный транспорт" },
]

const currentYear = new Date().getFullYear()

/**
 * Быстрая подача объявления.
 *
 * Полная форма спрашивает четыре десятка характеристик — для продавца,
 * который просто хочет выставить машину, это заградительный барьер. Здесь
 * остались только поля, без которых объявление бессмысленно; остальное
 * владелец дополняет после публикации.
 */
export default function QuickCreatePage() {
  const [form, setForm] = useState({
    vehicleType: "CAR",
    make: "",
    model: "",
    year: "" as string | number,
    price: "" as string | number,
    mileage: "" as string | number,
    location: "",
    description: "",
  })
  const [images, setImages] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [state, setState] = useState<"idle" | "saving" | "done">("idle")
  const [error, setError] = useState<string | null>(null)

  const canSubmit = Boolean(
    form.make.trim() && form.model.trim() && form.location.trim()
    && Number(form.year) >= 1886 && Number(form.year) <= currentYear + 1
    && Number(form.price) > 0,
  )

  const uploadPhotos = async (files: FileList | null) => {
    if (!files?.length) return
    setIsUploading(true)
    setError(null)
    try {
      const uploaded: string[] = []
      for (const file of Array.from(files).slice(0, 12 - images.length)) {
        const body = new FormData()
        body.append("file", file)
        const response = await fetch("/api/upload", { method: "POST", body })
        const payload = await response.json().catch(() => null)
        if (response.ok && typeof payload?.url === "string") uploaded.push(payload.url)
      }
      if (!uploaded.length) setError("Не удалось загрузить фотографии. Попробуйте другой файл.")
      setImages((current) => [...current, ...uploaded].slice(0, 12))
    } catch (uploadError) {
      setError(getApiClientErrorMessage(uploadError, "Не удалось загрузить фотографии."))
    } finally {
      setIsUploading(false)
    }
  }

  const submit = async () => {
    setState("saving")
    setError(null)
    try {
      const response = await fetch("/api/vehicles/quick", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          year: Number(form.year),
          price: Number(form.price),
          mileage: form.mileage === "" ? null : Number(form.mileage),
          images,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        setError(typeof payload?.error === "string" ? payload.error : "Не удалось разместить объявление")
        setState("idle")
        return
      }
      setState("done")
    } catch (requestError) {
      setError(getApiClientErrorMessage(requestError, "Нет связи с сервером. Попробуйте ещё раз."))
      setState("idle")
    }
  }

  if (state === "done") {
    return (
      <Container size="sm" py="xl">
        <Card withBorder radius="lg" p="xl">
          <Stack align="center" gap="sm" ta="center">
            <ThemeIcon size={56} radius="xl" color="teal" variant="light"><IconCheck size={28} /></ThemeIcon>
            <Title order={2} size="h4">Объявление отправлено</Title>
            <Text size="sm" c="dimmed" maw={420}>
              Карточка появится в каталоге после проверки модератором. Пока она ждёт,
              вы можете дополнить характеристики — так объявление найдут быстрее.
            </Text>
            <Group gap="xs" mt="xs">
              <Button component={Link} href="/dashboard" color="indigo">Мои объявления</Button>
              <Button variant="light" color="gray" onClick={() => { setState("idle"); setForm({ ...form, make: "", model: "", year: "", price: "", mileage: "", description: "" }); setImages([]) }}>
                Разместить ещё
              </Button>
            </Group>
          </Stack>
        </Card>
      </Container>
    )
  }

  return (
    <Container size="sm" py={{ base: "md", md: "xl" }}>
      <Stack gap="md">
        <Group gap="sm" align="center">
          <ThemeIcon variant="light" color="indigo" size={44} radius="md"><IconBolt size={22} /></ThemeIcon>
          <Box>
            <Title order={1} size="h3" ff="var(--font-display),sans-serif">Быстрое размещение</Title>
            <Text size="sm" c="dimmed">Шесть полей и фотографии. Остальное добавите потом.</Text>
          </Box>
        </Group>

        <Card withBorder radius="lg" p="md">
          <Stack gap="sm">
            <Select
              label="Что размещаете"
              data={VEHICLE_TYPES}
              value={form.vehicleType}
              onChange={(value) => setForm({ ...form, vehicleType: value || "CAR" })}
              allowDeselect={false}
            />
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <TextInput required label="Марка" placeholder="Haval" value={form.make} onChange={(event) => setForm({ ...form, make: event.currentTarget.value })} />
              <TextInput required label="Модель" placeholder="Jolion" value={form.model} onChange={(event) => setForm({ ...form, model: event.currentTarget.value })} />
              <NumberInput required label="Год выпуска" placeholder={String(currentYear - 3)} min={1886} max={currentYear + 1} value={form.year} onChange={(value) => setForm({ ...form, year: value })} />
              <NumberInput required label="Цена, ₽" placeholder="1 500 000" min={1} thousandSeparator=" " value={form.price} onChange={(value) => setForm({ ...form, price: value })} />
              <NumberInput label="Пробег, км" placeholder="Необязательно" min={0} max={2_000_000} thousandSeparator=" " value={form.mileage} onChange={(value) => setForm({ ...form, mileage: value })} />
              <TextInput required label="Город" placeholder="Москва" value={form.location} onChange={(event) => setForm({ ...form, location: event.currentTarget.value })} />
            </SimpleGrid>
            <Textarea
              label="Описание"
              placeholder="Состояние, комплектация, история обслуживания"
              description="Необязательно, но объявления с описанием смотрят чаще"
              autosize
              minRows={2}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.currentTarget.value })}
            />
          </Stack>
        </Card>

        <Card withBorder radius="lg" p="md">
          <Group justify="space-between" gap="xs" wrap="wrap" mb="sm">
            <Group gap="xs">
              <ThemeIcon variant="light" color="teal" size={30} radius="md"><IconPhoto size={16} /></ThemeIcon>
              <Box>
                <Text size="sm" fw={700}>Фотографии</Text>
                <Text size="xs" c="dimmed">Первая станет обложкой. До 12 штук.</Text>
              </Box>
            </Group>
            {images.length > 0 && <Badge variant="light" color="teal">{images.length} из 12</Badge>}
          </Group>

          <Button
            component="label"
            variant="light"
            color="indigo"
            fullWidth
            loading={isUploading}
            disabled={images.length >= 12}
            leftSection={<IconPhoto size={16} />}
          >
            {images.length ? "Добавить ещё" : "Выбрать фотографии"}
            <input type="file" accept="image/*" multiple hidden onChange={(event) => uploadPhotos(event.currentTarget.files)} />
          </Button>

          {images.length > 0 && (
            <SimpleGrid cols={{ base: 3, sm: 4 }} spacing={6} mt="sm">
              {images.map((url, index) => (
                <Box key={url} pos="relative" style={{ aspectRatio: "4 / 3", overflow: "hidden", borderRadius: 8 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Фото ${index + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <Button
                    size="compact-xs"
                    color="red"
                    variant="filled"
                    pos="absolute"
                    top={4}
                    right={4}
                    onClick={() => setImages((current) => current.filter((item) => item !== url))}
                  >
                    ✕
                  </Button>
                </Box>
              ))}
            </SimpleGrid>
          )}
        </Card>

        {error && <Alert color="red" variant="light">{error}</Alert>}

        <Button size="lg" color="indigo" onClick={submit} loading={state === "saving"} disabled={!canSubmit}>
          Разместить объявление
        </Button>

        <Text size="xs" c="dimmed" ta="center">
          Объявление уходит на проверку модератором. Характеристики можно дополнить после публикации —{" "}
          <Link href="/listings/create/vehicle" style={{ color: "inherit" }}>или заполнить подробную форму сразу</Link>.
        </Text>
      </Stack>
    </Container>
  )
}
