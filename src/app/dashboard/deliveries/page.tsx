"use client"

import { FormEvent, Suspense, useEffect, useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Alert, Badge, Box, Button, Center, Divider, Group, Loader, Modal, Paper, Progress, Select, SimpleGrid, Stack, Text, TextInput, Textarea, ThemeIcon, Title } from "@mantine/core"
import { notifications } from "@mantine/notifications"
import { IconArrowRight, IconBuildingWarehouse, IconCheck, IconChevronRight, IconClipboardCheck, IconFileInvoice, IconGavel, IconMapPin, IconPackage, IconPlus, IconRoute, IconShieldCheck, IconTruckDelivery } from "@tabler/icons-react"
import { DELIVERY_COUNTRIES, DELIVERY_STATUS_META, deliveryProgress } from "@/lib/delivery"
import { fetchJson } from "@/lib/api-client"
import { AsyncErrorState, EmptyState } from "@/components/ui/AsyncStates"
import DashboardNav from "@/components/dashboard/DashboardNav"
import { formatPriceShort } from "@/lib/format"

const sourceOptions = [
  { value: "AUCTION", label: "Аукцион" },
  { value: "DIRECT_IMPORT", label: "Прямой импорт" },
  { value: "PARTS_ORDER", label: "Запчасть под заказ" },
]

type DeliveryOrderListItem = {
  id: string
  code: string
  kind: "VEHICLE" | "PART"
  sourceType: "AUCTION" | "DIRECT_IMPORT" | "PARTS_ORDER"
  status: string
  title: string
  originCountry: string
  originCity: string | null
  destinationCity: string
  nextAction: string | null
}

type DeliveryOrdersResponse = {
  orders: DeliveryOrderListItem[]
  summary: { total: number; active: number; pendingPayments: number; needsAttention: number }
}

type AuctionPrefillResponse = {
  listing: { make: string; model: string; year: number; lotNumber: string | null; country: string; location: string | null }
}

type DeliveryOrganization = {
  id: string
  legalName: string
  inn: string
  ogrn: string | null
  organizationType: string
  serviceRegions: string | null
  verificationStatus: "PENDING" | "VERIFIED" | "REJECTED" | "SUSPENDED"
  verificationNote: string | null
}

type DeliveryOrganizationResponse = { organization: DeliveryOrganization | null }

type AuctionOffer = {
  id: string
  matchReason: string | null
  expiresAt: string
  inquiry: {
    id: string
    name: string
    city: string | null
    comment: string | null
    auctionListing: {
      id: string
      make: string
      model: string
      year: number
      country: string
      source: string
      lotNumber: string | null
      finalPrice: number
      imageUrl: string | null
    }
  }
}

type AuctionOffersResponse = {
  organization: { id: string; legalName: string } | null
  offers: AuctionOffer[]
}

const organizationTypeOptions = [
  { value: "COMPANY", label: "ООО или другая компания" },
  { value: "ENTREPRENEUR", label: "Индивидуальный предприниматель" },
  { value: "LOGISTICS", label: "Логистическая компания" },
  { value: "BROKER", label: "Таможенный брокер" },
]

const organizationStatusMeta = {
  PENDING: { label: "Заявка на проверке", color: "orange" },
  VERIFIED: { label: "Партнёр проверен", color: "teal" },
  REJECTED: { label: "Нужны исправления", color: "red" },
  SUSPENDED: { label: "Проверка приостановлена", color: "gray" },
} as const

export default function DeliveriesPage() {
  return <Suspense fallback={<Center py={100}><Loader color="indigo" /></Center>}><DeliveriesWorkspace /></Suspense>
}

function DeliveriesWorkspace() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const auctionListingIdFromSearch = searchParams.get("auctionListingId")
  const { data, error, isLoading, mutate } = useSWR<DeliveryOrdersResponse>("/api/delivery-orders", fetchJson)
  const { data: organizationData, mutate: mutateOrganization } = useSWR<DeliveryOrganizationResponse>("/api/delivery-organizations", fetchJson)
  const isVerifiedPartner = organizationData?.organization?.verificationStatus === "VERIFIED"
  const { data: auctionOffersData, mutate: mutateAuctionOffers } = useSWR<AuctionOffersResponse>(isVerifiedPartner ? "/api/partner/auction-offers" : null, fetchJson, { revalidateOnFocus: true })
  const [opened, setOpened] = useState(false)
  const [partnerOpened, setPartnerOpened] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [partnerSubmitting, setPartnerSubmitting] = useState(false)
  const [acceptingOfferId, setAcceptingOfferId] = useState<string | null>(null)
  const [form, setForm] = useState({ title: "", kind: "VEHICLE", sourceType: "AUCTION", originCountry: "CN", destinationCity: "", originCity: "", description: "", auctionListingId: "" })
  const [partnerForm, setPartnerForm] = useState({ legalName: "", inn: "", ogrn: "", organizationType: "COMPANY", serviceRegions: "" })

  useEffect(() => {
    const auctionListingId = auctionListingIdFromSearch
    if (!auctionListingId || form.auctionListingId === auctionListingId) return

    void fetchJson<AuctionPrefillResponse>(`/api/auctions/${auctionListingId}`)
      .then(({ listing }) => {
        const originCountry = DELIVERY_COUNTRIES.some((country) => country.value === listing.country) ? listing.country : "OTHER"
        setForm((current) => ({
          ...current,
          auctionListingId,
          title: `${listing.make} ${listing.model} ${listing.year}${listing.lotNumber ? ` · лот ${listing.lotNumber}` : ""}`,
          originCountry,
          originCity: listing.location || "",
          sourceType: "AUCTION",
        }))
        setOpened(true)
      })
      .catch((loadError: unknown) => {
        notifications.show({
          title: "Лот недоступен",
          message: loadError instanceof Error ? loadError.message : "Можно создать заявку вручную.",
          color: "orange",
        })
      })
  }, [auctionListingIdFromSearch, form.auctionListingId])

  const createOrder = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    try {
      const payload = await fetchJson<{ order: { id: string } }>("/api/delivery-orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
      notifications.show({ title: "Заявка создана", message: "Сделка появилась в вашем кабинете. Счёт появится только после согласования условий.", color: "teal" })
      await mutate()
      router.push(`/dashboard/deliveries/${payload.order.id}`)
    } catch (createError: unknown) {
      notifications.show({ title: "Не удалось создать заявку", message: createError instanceof Error ? createError.message : "Попробуйте ещё раз", color: "red" })
    } finally {
      setSubmitting(false)
    }
  }

  const openPartnerApplication = () => {
    const organization = organizationData?.organization
    if (organization) {
      setPartnerForm({
        legalName: organization.legalName,
        inn: organization.inn,
        ogrn: organization.ogrn || "",
        organizationType: organization.organizationType,
        serviceRegions: formatOrganizationRegions(organization.serviceRegions),
      })
    }
    setPartnerOpened(true)
  }

  const submitPartnerApplication = async (event: FormEvent) => {
    event.preventDefault()
    setPartnerSubmitting(true)
    try {
      await fetchJson<DeliveryOrganizationResponse>("/api/delivery-organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partnerForm),
      })
      await mutateOrganization()
      setPartnerOpened(false)
      notifications.show({ title: "Заявка принята", message: "Реквизиты появились в реестре администратора. Сообщим результат после проверки.", color: "teal" })
    } catch (submitError: unknown) {
      notifications.show({ title: "Не удалось отправить заявку", message: submitError instanceof Error ? submitError.message : "Проверьте реквизиты и повторите попытку.", color: "red" })
    } finally {
      setPartnerSubmitting(false)
    }
  }

  const acceptAuctionOffer = async (offerId: string) => {
    setAcceptingOfferId(offerId)
    try {
      const payload = await fetchJson<{ order: { id: string } }>("/api/partner/auction-offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId }),
      })
      await Promise.all([mutateAuctionOffers(), mutate()])
      notifications.show({ title: "Заявка принята", message: "Сделка и защищённый чат открыты в кабинете.", color: "teal" })
      router.push("/dashboard/deliveries/" + payload.order.id)
    } catch (acceptError: unknown) {
      notifications.show({ title: "Не удалось принять заявку", message: acceptError instanceof Error ? acceptError.message : "Обновите список и повторите попытку.", color: "red" })
      await mutateAuctionOffers()
    } finally {
      setAcceptingOfferId(null)
    }
  }

  if (isLoading) return <Center py={100}><Loader color="indigo" aria-label="Загружаем доставки" /></Center>
  if (error) return <Box py={80}><AsyncErrorState title="Не удалось загрузить доставки" description={error instanceof Error ? error.message : "Проверьте подключение и повторите попытку."} onRetry={() => void mutate()} backHref="/dashboard" backLabel="В кабинет" /></Box>

  const orders = data?.orders || []
  const summary = data?.summary || { total: 0, active: 0, pendingPayments: 0, needsAttention: 0 }

  return (
    <Box p={{ base: "sm", md: "lg" }}>
      <Stack gap="md">
        <DashboardNav active="deliveries" />
        <Paper radius="xl" p={{ base: "lg", md: 36 }} style={{ color: "white", overflow: "hidden", position: "relative", isolation: "isolate", background: "radial-gradient(circle at 88% 14%, rgba(139,92,246,.72), transparent 29%), linear-gradient(126deg, #071329 0%, #142c63 52%, #4038b9 100%)", boxShadow: "0 24px 60px rgba(25, 48, 103, .22)" }}>
          <Box aria-hidden style={{ position: "absolute", width: 260, height: 260, borderRadius: "50%", border: "1px solid rgba(255,255,255,.14)", right: -70, bottom: -150, zIndex: -1 }} />
          <Group justify="space-between" align="flex-start" wrap="wrap" gap="lg">
            <Stack gap="xs" maw={650}>
              <Group gap="xs"><ThemeIcon size={36} radius="md" variant="white" color="indigo"><IconRoute size={19} /></ThemeIcon><Badge color="indigo" variant="white">Международная доставка</Badge></Group>
              <Title order={1} fz={{ base: 28, md: 42 }} lh={1.04} lts="-.025em" ff="var(--font-display), sans-serif">Маршрут, документы и статусы — в одном кабинете</Title>
              <Text c="rgba(255,255,255,.8)" size="md" maw={610}>Сопровождаем автомобиль или запчасть от зарубежной площадки до выдачи в вашем городе. Партнёры и реквизиты появляются только после проверки.</Text>
              <Group gap="xs" mt="xs"><Badge color="cyan" variant="light">Прозрачные этапы</Badge><Badge color="violet" variant="light">Раздельные счета</Badge><Badge color="teal" variant="light">Проверенные партнёры</Badge></Group>
            </Stack>
            <Button onClick={() => setOpened(true)} color="white" c="indigo" leftSection={<IconPlus size={17} />} radius="xl" size="md">Рассчитать доставку</Button>
          </Group>
        </Paper>

        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
          <Metric label="Всего сделок" value={summary.total} icon={<IconPackage size={18} />} color="indigo" />
          <Metric label="В работе" value={summary.active} icon={<IconTruckDelivery size={18} />} color="blue" />
          <Metric label="Счета и квитанции" value={summary.pendingPayments} icon={<IconFileInvoice size={18} />} color="orange" />
          <Metric label="Требует внимания" value={summary.needsAttention} icon={<IconShieldCheck size={18} />} color={summary.needsAttention ? "red" : "teal"} />
        </SimpleGrid>

        {isVerifiedPartner && (
          <Paper withBorder radius="xl" p={{ base: "md", md: "lg" }} style={{ background: "linear-gradient(135deg, rgba(249,115,22,.07), rgba(79,70,229,.055))" }}>
            <Stack gap="md">
              <Group justify="space-between" gap="sm" wrap="wrap">
                <Group gap="sm" wrap="nowrap">
                  <ThemeIcon size={42} radius="lg" variant="light" color="orange"><IconGavel size={21} /></ThemeIcon>
                  <Stack gap={1}>
                    <Group gap="xs"><Text fw={850} fz="lg">Заявки рядом</Text><Badge color="teal" variant="light">Автораспределение включено</Badge></Group>
                    <Text size="sm" c="dimmed">Показываем город и данные лота без телефона и почты. Кто первым принимает заявку, тот открывает сделку.</Text>
                  </Stack>
                </Group>
                <Badge variant="white" color="orange">{auctionOffersData?.offers.length || 0} доступно</Badge>
              </Group>

              {auctionOffersData?.offers.length ? (
                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
                  {auctionOffersData.offers.map((offer) => {
                    const listing = offer.inquiry.auctionListing
                    return (
                      <Paper key={offer.id} withBorder radius="lg" p="md">
                        <Stack gap="sm">
                          <Group justify="space-between" gap="xs" wrap="nowrap">
                            <Badge color="orange" variant="light">{listing.source}</Badge>
                            <Text size="xs" c="dimmed">до {new Date(offer.expiresAt).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</Text>
                          </Group>
                          <Box>
                            <Text fw={850} lineClamp={2}>{listing.make} {listing.model} {listing.year}</Text>
                            <Text size="sm" c="dimmed">{countryLabel(listing.country)} · {listing.lotNumber ? "лот " + listing.lotNumber + " · " : ""}{formatPriceShort(listing.finalPrice)}</Text>
                          </Box>
                          <Group gap={6}><IconMapPin size={15} color="#4f46e5" /><Text size="sm" fw={700}>{offer.inquiry.city || "Город уточняется"}</Text><Text size="sm" c="dimmed">· {offer.inquiry.name}</Text></Group>
                          {offer.matchReason && <Text size="xs" c="teal.7">{offer.matchReason}</Text>}
                          {offer.inquiry.comment && <Text size="xs" c="dimmed" lineClamp={2}>{offer.inquiry.comment}</Text>}
                          <Button color="orange" radius="md" onClick={() => acceptAuctionOffer(offer.id)} loading={acceptingOfferId === offer.id} disabled={Boolean(acceptingOfferId)} rightSection={<IconArrowRight size={16} />}>Принять в работу</Button>
                        </Stack>
                      </Paper>
                    )
                  })}
                </SimpleGrid>
              ) : (
                <Text size="sm" c="dimmed">Новых подходящих заявок сейчас нет. Как только появится заявка по вашей географии, она отобразится здесь и придёт в уведомления.</Text>
              )}
            </Stack>
          </Paper>
        )}

        <Group justify="space-between" align="center">
          <Stack gap={0}><Title order={2} fz="h3">Мои доставки</Title><Text size="sm" c="dimmed">Только сделки, в которых вы участвуете.</Text></Stack>
          {orders.length > 0 && <Button variant="light" color="indigo" size="xs" onClick={() => setOpened(true)} leftSection={<IconPlus size={14} />}>Создать</Button>}
        </Group>

        {orders.length === 0 ? (
          <EmptyState title="Пока нет заявок на доставку" description="Создайте первую заявку. Менеджер сначала согласует маршрут и партнёра — реквизиты для оплаты не появляются автоматически." actionLabel="Создать заявку" onAction={() => setOpened(true)} />
        ) : (
          <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="sm">
            {orders.map((order) => {
              const meta = DELIVERY_STATUS_META[order.status as keyof typeof DELIVERY_STATUS_META] || DELIVERY_STATUS_META.REQUEST_CREATED
              return <Paper key={order.id} component={Link} href={`/dashboard/deliveries/${order.id}`} withBorder radius="lg" p="md" className="delivery-order-card" style={{ textDecoration: "none", color: "inherit" }}>
                <Stack gap="sm">
                  <Group justify="space-between" gap="xs" wrap="nowrap"><Badge variant="light" color={meta.color}>{meta.shortLabel}</Badge><Text size="xs" c="dimmed" fw={600}>{order.code}</Text></Group>
                  <Stack gap={2}><Text fw={800} lineClamp={2}>{order.title}</Text><Text size="xs" c="dimmed">{order.kind === "PART" ? "Запчасть" : "Автомобиль"} · {order.sourceType === "AUCTION" ? "аукцион" : order.sourceType === "PARTS_ORDER" ? "под заказ" : "прямой импорт"}</Text></Stack>
                  <Group gap={6} wrap="nowrap"><IconMapPin size={15} color="#64748b" /><Text size="sm" c="dimmed" lineClamp={1}>{countryLabel(order.originCountry)}{order.originCity ? `, ${order.originCity}` : ""}</Text><IconArrowRight size={14} color="#94a3b8" /><Text size="sm" fw={600} lineClamp={1}>{order.destinationCity}</Text></Group>
                  <Box><Group justify="space-between" mb={4}><Text size="xs" c="dimmed">{meta.label}</Text><Text size="xs" fw={700}>{deliveryProgress(order.status)}%</Text></Group><Progress value={deliveryProgress(order.status)} color={meta.color} size="sm" radius="xl" /></Box>
                  <Group justify="space-between"><Text size="xs" c="dimmed" lineClamp={1}>{order.nextAction || meta.description}</Text><IconChevronRight size={17} color="#64748b" /></Group>
                </Stack>
              </Paper>
            })}
          </SimpleGrid>
        )}

        <Paper withBorder radius="xl" p={{ base: "md", md: "lg" }} style={{ background: "linear-gradient(135deg, rgba(79,70,229,.055), rgba(20,184,166,.045))" }}>
          <Group justify="space-between" align="center" gap="lg" wrap="wrap">
            <Group gap="md" wrap="nowrap" style={{ flex: 1, minWidth: 280 }}>
              <ThemeIcon size={48} radius="lg" variant="gradient" gradient={{ from: "indigo", to: "violet", deg: 135 }}><IconBuildingWarehouse size={24} /></ThemeIcon>
              <Stack gap={4}>
                <Group gap="xs" wrap="wrap"><Text fw={850} fz="lg">Работаете с международной доставкой?</Text>{organizationData?.organization && <Badge variant="light" color={organizationStatusMeta[organizationData.organization.verificationStatus].color}>{organizationStatusMeta[organizationData.organization.verificationStatus].label}</Badge>}</Group>
                <Text size="sm" c="dimmed" maw={720}>ИП, ООО, логистические компании и брокеры могут подать реквизиты. После проверки организация попадёт в закрытый реестр партнёров LeWheel.</Text>
              </Stack>
            </Group>
            <Button onClick={openPartnerApplication} variant={organizationData?.organization ? "light" : "filled"} color="indigo" radius="xl" leftSection={<IconClipboardCheck size={17} />}>{organizationData?.organization ? "Открыть заявку" : "Стать партнёром"}</Button>
          </Group>
        </Paper>
      </Stack>

      <Modal opened={opened} onClose={() => setOpened(false)} title="Заявка на международную доставку" centered radius="xl" size="lg">
        <form onSubmit={createOrder}><Stack gap="sm">
          <Text size="sm" c="dimmed">Это заявка на сопровождение, а не платёж. Сначала согласуем маршрут, партнёра и документы.</Text>
          {form.auctionListingId && <Badge color="orange" variant="light">Выбран лот аукциона — он будет привязан к сделке</Badge>}
          <TextInput required label="Что нужно доставить" placeholder="Например, Toyota RAV4 2023, лот 1842" value={form.title} onChange={(e) => setForm({ ...form, title: e.currentTarget.value })} />
          <SimpleGrid cols={{ base: 1, sm: 2 }}><Select label="Что доставляем" data={[{ value: "VEHICLE", label: "Автомобиль" }, { value: "PART", label: "Запчасть" }]} value={form.kind} onChange={(value) => setForm({ ...form, kind: value || "VEHICLE" })} /><Select label="Источник" data={sourceOptions} value={form.sourceType} onChange={(value) => setForm({ ...form, sourceType: value || "AUCTION" })} /></SimpleGrid>
          <SimpleGrid cols={{ base: 1, sm: 2 }}><Select required label="Страна отправления" data={DELIVERY_COUNTRIES} value={form.originCountry} onChange={(value) => setForm({ ...form, originCountry: value || "CN" })} /><TextInput label="Город / порт отправления" placeholder="Например, Суйфэньхэ" value={form.originCity} onChange={(e) => setForm({ ...form, originCity: e.currentTarget.value })} /></SimpleGrid>
          <TextInput required label="Город доставки в России" placeholder="Например, Екатеринбург" value={form.destinationCity} onChange={(e) => setForm({ ...form, destinationCity: e.currentTarget.value })} />
          <Textarea label="Комментарий" placeholder="Нужен маршрут, бюджет, номер лота, особые условия" minRows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.currentTarget.value })} />
          <Button type="submit" loading={submitting} color="indigo" rightSection={<IconArrowRight size={16} />}>Создать заявку</Button>
        </Stack></form>
      </Modal>

      <Modal opened={partnerOpened} onClose={() => setPartnerOpened(false)} title="Заявка партнёра LeWheel" centered radius="xl" size="lg">
        <form onSubmit={submitPartnerApplication}><Stack gap="sm">
          <Alert color="indigo" icon={<IconShieldCheck size={18} />} title="Реквизиты проверяет администратор">Заявка не даёт автоматический доступ к заказам. До назначения партнёром мы сверим организацию и направления работы.</Alert>
          {organizationData?.organization?.verificationNote && <Alert color="orange" title="Комментарий проверки">{organizationData.organization.verificationNote}</Alert>}
          <TextInput required label="Полное наименование" placeholder="ООО «Транс Логистика»" value={partnerForm.legalName} onChange={(event) => setPartnerForm({ ...partnerForm, legalName: event.currentTarget.value })} />
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Select required allowDeselect={false} label="Тип организации" data={organizationTypeOptions} value={partnerForm.organizationType} onChange={(value) => setPartnerForm({ ...partnerForm, organizationType: value || "COMPANY" })} />
            <TextInput required inputMode="numeric" label="ИНН" placeholder="10 или 12 цифр" value={partnerForm.inn} onChange={(event) => setPartnerForm({ ...partnerForm, inn: event.currentTarget.value.replace(/\D/g, "").slice(0, 12) })} />
          </SimpleGrid>
          <TextInput inputMode="numeric" label="ОГРН / ОГРНИП" description="Можно заполнить после подачи, если номера пока нет под рукой." placeholder="13 или 15 цифр" value={partnerForm.ogrn} onChange={(event) => setPartnerForm({ ...partnerForm, ogrn: event.currentTarget.value.replace(/\D/g, "").slice(0, 15) })} />
          <Textarea required label="География и направления" placeholder="Китай — Владивосток — Екатеринбург; Корея — Москва" minRows={3} value={partnerForm.serviceRegions} onChange={(event) => setPartnerForm({ ...partnerForm, serviceRegions: event.currentTarget.value })} />
          <Divider />
          <Group justify="space-between" gap="sm" wrap="wrap"><Text size="xs" c="dimmed" maw={390}>После отправки заявка получит статус «На проверке». Платёжные реквизиты в этой форме не запрашиваются.</Text><Button type="submit" loading={partnerSubmitting} color="indigo" radius="xl" leftSection={<IconCheck size={17} />}>Отправить на проверку</Button></Group>
        </Stack></form>
      </Modal>
    </Box>
  )
}

function Metric({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return <Paper withBorder radius="lg" p="sm"><Group gap="sm"><ThemeIcon variant="light" color={color} radius="md" size={38}>{icon}</ThemeIcon><Stack gap={0}><Text fw={800} fz="lg">{value}</Text><Text size="xs" c="dimmed">{label}</Text></Stack></Group></Paper>
}

function countryLabel(code: string) {
  return DELIVERY_COUNTRIES.find((country) => country.value === code)?.label || code
}

function formatOrganizationRegions(value: string | null) {
  if (!value) return ""
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").join(", ") : value
  } catch {
    return value
  }
}
