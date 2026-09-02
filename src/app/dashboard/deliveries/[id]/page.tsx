"use client"

import { FormEvent, useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ActionIcon, Alert, Avatar, Badge, Box, Button, Center, Divider, FileInput, Group, Loader, Modal, Paper, Progress, Select, SimpleGrid, Stack, Text, Textarea, TextInput, ThemeIcon, Timeline, Title } from "@mantine/core"
import { notifications } from "@mantine/notifications"
import { IconArrowLeft, IconArrowRight, IconCalendar, IconCheck, IconCircleCheck, IconClock, IconFileDescription, IconFileInvoice, IconLock, IconMapPin, IconMessageCircle, IconNotes, IconPlus, IconReceipt, IconRoute, IconSend, IconShieldCheck, IconSparkles, IconTruckDelivery, IconUpload } from "@tabler/icons-react"
import { canTransitionDeliveryStatus, DELIVERY_DOCUMENT_META, DELIVERY_PAYMENT_META, DELIVERY_STATUSES, DELIVERY_STATUS_META, deliveryProgress } from "@/lib/delivery"
import { AsyncErrorState } from "@/components/ui/AsyncStates"
import { fetchJson } from "@/lib/api-client"

type DeliveryUser = { id: string; name: string | null; image: string | null; deliveryOrganizations?: Array<{ id: string; legalName: string; verificationStatus: string }> }

type DeliveryEvent = {
  id: string
  status: string
  title: string
  description: string | null
  source: string
  completedAt: string
  expectedAt: string | null
  author: DeliveryUser | null
}

type DeliveryPayment = {
  id: string
  category: string
  status: string
  amount: number | null
  currency: string
  payeeName: string | null
  invoiceNumber: string | null
  instruction: string | null
}

type DeliveryDocument = {
  id: string
  title: string
  category: string
  size: number
  downloadUrl: string
}

type DeliveryMessage = {
  id: string
  content: string
  isSystem: boolean
  createdAt: string
  sender: DeliveryUser | null
}

type DeliveryOrder = {
  id: string
  code: string
  kind: string
  status: string
  statusSource: string
  title: string
  originCountry: string
  originCity: string | null
  originCheckpoint: string | null
  destinationCity: string
  destinationRegion: string | null
  estimatedDeliveryAt: string | null
  nextAction: string | null
  nextActionAt: string | null
  buyerDepositAmount: number | null
  buyerDepositStatus: string
  platformFeeAmount: number | null
  platformFeeStatus: string
  buyer: DeliveryUser
  partner: DeliveryUser | null
  manager: DeliveryUser | null
  events: DeliveryEvent[]
  payments: DeliveryPayment[]
  documents: DeliveryDocument[]
  messages: DeliveryMessage[]
}

type DeliveryOrderResponse = {
  order: DeliveryOrder
  permissions: { currentUserId: string | null; canManage: boolean; isBuyer: boolean; isAdmin: boolean }
}

const paymentStatusMeta: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Черновик", color: "gray" },
  INVOICE_ISSUED: { label: "Ожидает оплаты", color: "orange" },
  AWAITING_CONFIRMATION: { label: "Квитанция на проверке", color: "violet" },
  CONFIRMED: { label: "Подтверждено", color: "teal" },
  OVERDUE: { label: "Срок уточняется", color: "red" },
  CANCELED: { label: "Отменено", color: "gray" },
}

const QUICK_DEAL_QUESTIONS = [
  "Какие документы нужны для начала выкупа?",
  "Что входит в расчёт доставки?",
  "Какие повреждения нужно проверить по лоту?",
  "Когда будет готов договор и счёт?",
]

export default function DeliveryOrderPage() {
  const params = useParams<{ id: string }>()
  const { data, error, isLoading, mutate } = useSWR<DeliveryOrderResponse>(params.id ? `/api/delivery-orders/${params.id}` : null, fetchJson)
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [eventOpened, setEventOpened] = useState(false)
  const [paymentOpened, setPaymentOpened] = useState(false)
  const [eventForm, setEventForm] = useState({ status: "", title: "", description: "", nextAction: "", expectedAt: "" })
  const [paymentForm, setPaymentForm] = useState({ category: "DEPOSIT", amount: "", currency: "RUB", payeeName: "", invoiceNumber: "", instruction: "", dueAt: "" })
  const [uploadTarget, setUploadTarget] = useState<{ paymentId?: string; category: string; label: string } | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  /* Пока запрос идёт, кнопка должна быть занята.

     Здесь этого не было: на медленной связи человек не видел отклика и
     нажимал второй раз — в ленте появлялись два одинаковых этапа, а в
     сделке два счёта на одну сумму. Покупатель видел дубли и удалить
     их не мог. Рядом, у загрузки документа, состояние уже есть — то
     есть это был пропуск, а не решение. */
  const [savingEvent, setSavingEvent] = useState(false)
  const [savingPayment, setSavingPayment] = useState(false)

  if (isLoading) return <Center py={100}><Loader color="indigo" /></Center>
  if (error || !data?.order) return <Box py={80}><AsyncErrorState title="Не удалось открыть сделку" description={error?.message || "Сделка не найдена или у вас нет к ней доступа."} onRetry={() => void mutate()} backHref="/dashboard/deliveries" backLabel="К доставкам" /></Box>

  const order = data.order
  const permissions = data.permissions
  const statusMeta = DELIVERY_STATUS_META[order.status as keyof typeof DELIVERY_STATUS_META] || DELIVERY_STATUS_META.REQUEST_CREATED
  const progress = deliveryProgress(order.status)
  const availableNextStatuses = DELIVERY_STATUSES.filter((status) => canTransitionDeliveryStatus(order.status, status))

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault()
    if (!message.trim()) return
    setSending(true)
    try {
      await fetchJson(`/api/delivery-orders/${order.id}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: message }) })
      setMessage("")
      mutate()
    } catch (error: unknown) {
      notifications.show({ title: "Сообщение не отправлено", message: error instanceof Error ? error.message : "Повторите попытку", color: "red" })
    } finally { setSending(false) }
  }

  const addEvent = async (event: FormEvent) => {
    event.preventDefault()
    if (savingEvent) return
    setSavingEvent(true)
    try {
      await fetchJson(`/api/delivery-orders/${order.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...eventForm, expectedAt: eventForm.expectedAt || null }),
      })
      notifications.show({ title: "Этап подтверждён", message: "В истории сохранены автор, время и источник обновления.", color: "teal" })
      setEventOpened(false)
      setEventForm({ status: "", title: "", description: "", nextAction: "", expectedAt: "" })
      mutate()
    } catch (error: unknown) {
      notifications.show({ title: "Не удалось обновить маршрут", message: error instanceof Error ? error.message : "Повторите попытку", color: "red" })
    } finally {
      setSavingEvent(false)
    }
  }

  const addPayment = async (event: FormEvent) => {
    event.preventDefault()
    if (savingPayment) return
    setSavingPayment(true)
    try {
      await fetchJson(`/api/delivery-orders/${order.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...paymentForm, amount: Number(paymentForm.amount), dueAt: paymentForm.dueAt || null }),
      })
      notifications.show({ title: "Счёт добавлен", message: "Покупатель увидит сумму, назначение и срок в своей сделке.", color: "teal" })
      setPaymentOpened(false)
      setPaymentForm({ category: "DEPOSIT", amount: "", currency: "RUB", payeeName: "", invoiceNumber: "", instruction: "", dueAt: "" })
      mutate()
    } catch (error: unknown) {
      notifications.show({ title: "Не удалось добавить счёт", message: error instanceof Error ? error.message : "Повторите попытку", color: "red" })
    } finally {
      setSavingPayment(false)
    }
  }

  const uploadDocument = async () => {
    if (!selectedFile || !uploadTarget) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", selectedFile)
      formData.append("category", uploadTarget.category)
      formData.append("title", uploadTarget.label)
      if (uploadTarget.paymentId) formData.append("paymentId", uploadTarget.paymentId)
      await fetchJson(`/api/delivery-orders/${order.id}/documents`, { method: "POST", body: formData })
      notifications.show({ title: "Документ добавлен", message: uploadTarget.paymentId ? "Квитанция передана на проверку партнёру." : "Файл доступен участникам сделки.", color: "teal" })
      setSelectedFile(null)
      setUploadTarget(null)
      mutate()
    } catch (error: unknown) {
      notifications.show({ title: "Не удалось загрузить документ", message: error instanceof Error ? error.message : "Разрешены PDF, JPG, PNG и WebP", color: "red" })
    } finally { setUploading(false) }
  }

  const confirmPayment = async (paymentId: string) => {
    try {
      await fetchJson(`/api/delivery-orders/${order.id}/payments/${paymentId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "CONFIRMED" }) })
      notifications.show({ title: "Квитанция подтверждена", message: "Статус платежа обновлён в сделке.", color: "teal" })
      mutate()
    } catch (error: unknown) {
      notifications.show({ title: "Не удалось подтвердить", message: error instanceof Error ? error.message : "Повторите попытку", color: "red" })
    }
  }

  return <Box p={{ base: "sm", md: "lg" }}>
    <Stack gap="md">
      <Group justify="space-between" wrap="wrap"><Button component={Link} href="/dashboard/deliveries" variant="subtle" color="gray" size="xs" leftSection={<IconArrowLeft size={15} />}>Все доставки</Button><Text size="xs" c="dimmed" fw={700}>{order.code}</Text></Group>

      <Paper radius="md" p={{ base: "md", md: "xl" }} style={{ color: "white", background: "linear-gradient(122deg, #0a1733, #1f3d7a 62%, #5042bd)", overflow: "hidden" }}>
        <Stack gap="md"><Group justify="space-between" align="flex-start" wrap="wrap"><Stack gap={5}><Group gap="xs"><Badge variant="white" color={statusMeta.color}>{statusMeta.shortLabel}</Badge><Text size="xs" c="rgba(255,255,255,.62)">{order.kind === "PART" ? "Запчасть под заказ" : "Международная доставка транспорта"}</Text></Group><Title order={1} fz={{ base: 24, md: 31 }} ff="var(--font-display), sans-serif">{order.title}</Title><Text size="sm" c="rgba(255,255,255,.72)">{order.originCountry} {order.originCity ? `· ${order.originCity}` : ""} <IconArrowRight size={14} style={{ verticalAlign: "middle" }} /> {order.destinationCity}{order.destinationRegion ? `, ${order.destinationRegion}` : ""}</Text></Stack><ThemeIcon size={50} radius="lg" variant="white" color="indigo"><IconTruckDelivery size={27} /></ThemeIcon></Group>
          <Box><Group justify="space-between" mb={6}><Text fw={700}>{statusMeta.label}</Text><Text fw={800}>{progress}%</Text></Group><Progress value={progress} color={statusMeta.color} size="md" radius="xl" /></Box>
          <Group gap="sm" wrap="wrap"><RoutePill icon={<IconMapPin size={14} />} label="Точка маршрута" value={order.originCheckpoint || "уточняется"} /><RoutePill icon={<IconCalendar size={14} />} label="Ожидаемая выдача" value={formatDate(order.estimatedDeliveryAt)} /><RoutePill icon={<IconShieldCheck size={14} />} label="Источник статуса" value={sourceLabel(order.statusSource)} /></Group>
        </Stack>
      </Paper>

      <SimpleGrid cols={{ base: 1, xl: 3 }} spacing="md">
        <Stack gap="md" style={{ gridColumn: "span 2" }}>
          <Paper withBorder radius="md" p="md"><Group justify="space-between" align="flex-start" wrap="wrap"><Stack gap={2}><Group gap="xs"><ThemeIcon color="indigo" variant="light" radius="md"><IconClock size={17} /></ThemeIcon><Text fw={800}>Следующий шаг</Text></Group><Text c="dimmed" size="sm">{order.nextAction || statusMeta.description}</Text>{order.nextActionAt && <Text size="xs" c="indigo">Ориентир: {formatDate(order.nextActionAt)}</Text>}</Stack>{permissions.canManage && <Button size="xs" color="indigo" leftSection={<IconPlus size={14} />} onClick={() => setEventOpened(true)}>Подтвердить этап</Button>}</Group></Paper>

          <Paper withBorder radius="md" p="md"><Group justify="space-between" mb="md"><Group gap="xs"><ThemeIcon color="indigo" variant="light" radius="md"><IconRoute size={17} /></ThemeIcon><Text fw={800}>Лента маршрута</Text></Group><Badge variant="light" color={statusMeta.color}>{statusMeta.shortLabel}</Badge></Group>
            <Timeline active={Math.max(0, order.events.length - 1)} bulletSize={26} lineWidth={2}>
              {order.events.map((item) => { const meta = DELIVERY_STATUS_META[item.status as keyof typeof DELIVERY_STATUS_META] || statusMeta; return <Timeline.Item key={item.id} bullet={<IconCheck size={14} />} color={meta.color} title={<Group gap={6}><Text size="sm" fw={700}>{item.title}</Text>{item.source !== "MANUAL" && <Badge size="xs" variant="light" color="gray">{sourceLabel(item.source)}</Badge>}</Group>}><Stack gap={3} mt={4}><Text size="xs" c="dimmed">{item.description || meta.description}</Text><Text size="xs" c="gray.5">{formatDateTime(item.completedAt)} · {item.author?.name || "Система"}</Text>{item.expectedAt && <Text size="xs" c="indigo">Ожидаемый срок: {formatDate(item.expectedAt)}</Text>}</Stack></Timeline.Item> })}
            </Timeline>
          </Paper>

          <Paper withBorder radius="md" p="md"><Group gap="xs" mb="md"><ThemeIcon color="violet" variant="light" radius="md"><IconMessageCircle size={17} /></ThemeIcon><Text fw={800}>Чат сделки</Text><Badge variant="light" color="gray" size="xs">{order.messages.length}</Badge></Group>
            <Alert color="indigo" variant="light" icon={<IconLock size={17} />} title="Контакты защищены" mb="sm">Телефон, email, ссылки и контакты мессенджеров блокируются до отправки. Документы загружайте в закрытый раздел сделки.</Alert>
            <Stack gap="xs" mah={340} style={{ overflowY: "auto" }}>{order.messages.map((item) => <MessageBubble key={item.id} item={item} isOwn={item.sender?.id === permissions.currentUserId} />)}</Stack>
            <Divider my="sm" />
            <Group gap={6} mb="xs"><IconSparkles size={14} color="#1c4291" /><Text size="xs" fw={700} c="violet.8">Быстрые вопросы по базе сделки</Text></Group>
            <Group gap={6} mb="sm">{QUICK_DEAL_QUESTIONS.map((question) => <Button key={question} variant="light" color="gray" size="compact-xs" onClick={() => setMessage(question)}>{question}</Button>)}</Group>
            <form onSubmit={sendMessage}><Group align="flex-end" wrap="nowrap"><Textarea aria-label="Сообщение в чат сделки" placeholder="Спросите о лоте, маршруте, договоре или счёте…" minRows={2} maxRows={5} autosize value={message} onChange={(event) => setMessage(event.currentTarget.value)} style={{ flex: 1 }} /><ActionIcon type="submit" size="lg" variant="filled" color="indigo" loading={sending} aria-label="Отправить"><IconSend size={18} /></ActionIcon></Group></form>
          </Paper>
        </Stack>

        <Stack gap="md">
          <Paper withBorder radius="md" p="md"><Group gap="xs" mb="md"><ThemeIcon color="orange" variant="light" radius="md"><IconFileInvoice size={17} /></ThemeIcon><Text fw={800}>Счета и квитанции</Text>{permissions.canManage && <ActionIcon variant="light" color="indigo" onClick={() => setPaymentOpened(true)} aria-label="Добавить счёт"><IconPlus size={16} /></ActionIcon>}</Group>
            {order.payments.length === 0 ? <EmptyText text="Счета появятся после согласования договора и проверенного партнёра." /> : <Stack gap="xs">{order.payments.map((payment) => { const meta = paymentStatusMeta[payment.status] || paymentStatusMeta.DRAFT; return <Box key={payment.id} p="sm" style={{ borderRadius: 10, background: "var(--mantine-color-gray-0)" }}><Group justify="space-between" align="flex-start" gap="xs"><Stack gap={2}><Text size="sm" fw={700}>{DELIVERY_PAYMENT_META[payment.category] || payment.category}</Text><Text size="sm" fw={800}>{payment.amount?.toLocaleString("ru-RU")} {currencySymbol(payment.currency)}</Text>{payment.payeeName && <Text size="xs" c="dimmed">Получатель: {payment.payeeName}</Text>}{payment.invoiceNumber && <Text size="xs" c="dimmed">Счёт № {payment.invoiceNumber}</Text>}{payment.instruction && <Text size="xs" c="dimmed" lineClamp={3}>{payment.instruction}</Text>}</Stack><Badge size="xs" color={meta.color} variant="light">{meta.label}</Badge></Group>{payment.status === "INVOICE_ISSUED" && permissions.isBuyer && <Button mt="xs" size="compact-xs" variant="light" color="indigo" leftSection={<IconReceipt size={13} />} onClick={() => setUploadTarget({ paymentId: payment.id, category: "RECEIPT", label: `Квитанция: ${DELIVERY_PAYMENT_META[payment.category] || "платёж"}` })}>Приложить квитанцию</Button>}{payment.status === "AWAITING_CONFIRMATION" && permissions.canManage && <Button mt="xs" size="compact-xs" variant="light" color="teal" leftSection={<IconCheck size={13} />} onClick={() => confirmPayment(payment.id)}>Подтвердить квитанцию</Button>}</Box> })}</Stack>}
          </Paper>

          <Paper withBorder radius="md" p="md"><Group justify="space-between" mb="md"><Group gap="xs"><ThemeIcon color="cyan" variant="light" radius="md"><IconFileDescription size={17} /></ThemeIcon><Text fw={800}>Документы</Text></Group>{permissions.canManage && <Button size="compact-xs" variant="light" color="indigo" leftSection={<IconUpload size={13} />} onClick={() => setUploadTarget({ category: "OTHER", label: "Документ сделки" })}>Загрузить</Button>}</Group>
            {order.documents.length === 0 ? <EmptyText text="Подтверждения, договоры и квитанции появятся здесь. Доступ ограничен участниками этой сделки." /> : <Stack gap={4}>{order.documents.map((document) => <Group key={document.id} justify="space-between" gap="xs" wrap="nowrap"><Group gap="xs" style={{ minWidth: 0 }}><ThemeIcon size="sm" variant="light" color="cyan"><IconNotes size={13} /></ThemeIcon><Stack gap={0} style={{ minWidth: 0 }}><Text size="xs" fw={600} lineClamp={1}>{document.title}</Text><Text size="10px" c="dimmed">{DELIVERY_DOCUMENT_META[document.category] || document.category} · {formatBytes(document.size)}</Text></Stack></Group><Button component="a" href={document.downloadUrl} size="compact-xs" variant="subtle" color="indigo">Открыть</Button></Group>)}</Stack>}
          </Paper>

          <Paper withBorder radius="md" p="md"><Group gap="xs" mb="sm"><ThemeIcon color="teal" variant="light" radius="md"><IconCircleCheck size={17} /></ThemeIcon><Text fw={800}>Участники</Text></Group><Stack gap="xs"><Participant label="Покупатель" user={order.buyer} /><Participant label="Проверенный партнёр" user={order.partner} empty="Назначается менеджером" /><Participant label="Менеджер LeWheel" user={order.manager} empty="Назначается после проверки" /></Stack></Paper>
          {(order.buyerDepositAmount || order.platformFeeAmount) && <Paper withBorder radius="md" p="md"><Group gap="xs" mb="sm"><ThemeIcon color="orange" variant="light" radius="md"><IconReceipt size={17} /></ThemeIcon><Text fw={800}>Условия расчётов</Text></Group><Stack gap="xs">{order.buyerDepositAmount && <PaymentTerm label="Задаток по сделке" amount={order.buyerDepositAmount} status={order.buyerDepositStatus} />}{order.platformFeeAmount && <PaymentTerm label="Сервисный сбор LeWheel" amount={order.platformFeeAmount} status={order.platformFeeStatus} />}</Stack><Text size="xs" c="dimmed" mt="sm">Суммы учитываются раздельно. Оплата доступна только после публикации счёта и договора внутри сделки.</Text></Paper>}
        </Stack>
      </SimpleGrid>
    </Stack>

    <Modal opened={eventOpened} onClose={() => setEventOpened(false)} title="Подтвердить новый этап" centered radius="lg" closeOnClickOutside={false}><form onSubmit={addEvent}><Stack gap="sm"><Text size="sm" c="dimmed">Доступен только следующий этап, пауза или отмена. Не подтверждайте этап без документа или подтверждения партнёра.</Text><Select required label="Этап" data={availableNextStatuses.map((status) => ({ value: status, label: DELIVERY_STATUS_META[status].label }))} value={eventForm.status} onChange={(value) => setEventForm({ ...eventForm, status: value || "" })} /><TextInput label="Заголовок в ленте" placeholder="По умолчанию — название этапа" value={eventForm.title} onChange={(event) => setEventForm({ ...eventForm, title: event.currentTarget.value })} /><Textarea label="Что подтверждено" required minRows={3} value={eventForm.description} onChange={(event) => setEventForm({ ...eventForm, description: event.currentTarget.value })} /><TextInput label="Следующий шаг для покупателя" value={eventForm.nextAction} onChange={(event) => setEventForm({ ...eventForm, nextAction: event.currentTarget.value })} /><TextInput type="datetime-local" label="Ожидаемый срок следующего действия" value={eventForm.expectedAt} onChange={(event) => setEventForm({ ...eventForm, expectedAt: event.currentTarget.value })} /><Button type="submit" color="indigo" loading={savingEvent}>Сохранить подтверждённый этап</Button></Stack></form></Modal>

    <Modal opened={paymentOpened} onClose={() => setPaymentOpened(false)} title="Добавить счёт в сделку" centered radius="lg" closeOnClickOutside={false}><form onSubmit={addPayment}><Stack gap="sm"><Text size="sm" c="dimmed">Сайт не переводит деньги. Укажите назначение, счёт и получателя из проверенного договора.</Text><Select required label="Назначение" data={Object.entries(DELIVERY_PAYMENT_META).map(([value, label]) => ({ value, label }))} value={paymentForm.category} onChange={(value) => setPaymentForm({ ...paymentForm, category: value || "DEPOSIT" })} /><SimpleGrid cols={2}><TextInput required type="number" min="1" label="Сумма" value={paymentForm.amount} onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.currentTarget.value })} /><Select label="Валюта" data={["RUB", "CNY", "KRW", "JPY", "USD", "EUR"]} value={paymentForm.currency} onChange={(value) => setPaymentForm({ ...paymentForm, currency: value || "RUB" })} /></SimpleGrid><TextInput label="Получатель" value={paymentForm.payeeName} onChange={(event) => setPaymentForm({ ...paymentForm, payeeName: event.currentTarget.value })} /><TextInput label="Номер счёта" value={paymentForm.invoiceNumber} onChange={(event) => setPaymentForm({ ...paymentForm, invoiceNumber: event.currentTarget.value })} /><Textarea label="Назначение и инструкция" minRows={3} value={paymentForm.instruction} onChange={(event) => setPaymentForm({ ...paymentForm, instruction: event.currentTarget.value })} /><TextInput type="datetime-local" label="Срок оплаты" value={paymentForm.dueAt} onChange={(event) => setPaymentForm({ ...paymentForm, dueAt: event.currentTarget.value })} /><Button type="submit" color="indigo" loading={savingPayment}>Опубликовать счёт</Button></Stack></form></Modal>

    <Modal opened={Boolean(uploadTarget)} onClose={() => { setUploadTarget(null); setSelectedFile(null) }} title={uploadTarget?.label || "Загрузить документ"} centered radius="lg"><Stack gap="sm"><Text size="sm" c="dimmed">Файл хранится закрыто и выдаётся только участникам этой сделки. Поддерживаются PDF, JPG, PNG и WebP до 20 МБ.</Text><FileInput label="Файл" placeholder="Выберите файл" accept="application/pdf,image/jpeg,image/png,image/webp" value={selectedFile} onChange={setSelectedFile} clearable /><Button disabled={!selectedFile} loading={uploading} color="indigo" leftSection={<IconUpload size={16} />} onClick={uploadDocument}>Загрузить защищённо</Button></Stack></Modal>
  </Box>
}

function RoutePill({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <Group gap={6} p="xs" style={{ borderRadius: 9, background: "rgba(255,255,255,.11)" }}><Box c="rgba(255,255,255,.75)">{icon}</Box><Stack gap={0}><Text size="10px" c="rgba(255,255,255,.56)">{label}</Text><Text size="xs" fw={600}>{value}</Text></Stack></Group>
}

function MessageBubble({ item, isOwn }: { item: DeliveryMessage; isOwn: boolean }) {
  if (item.isSystem) return <Text size="xs" c="dimmed" ta="center" py={4}>{item.content}</Text>
  return <Group align="flex-start" gap="xs" justify={isOwn ? "flex-end" : "flex-start"}><Avatar size="sm" radius="xl" src={item.sender?.image}>{item.sender?.name?.[0]?.toUpperCase()}</Avatar><Box maw="78%" p="sm" style={{ borderRadius: 12, background: isOwn ? "var(--mantine-color-indigo-6)" : "var(--mantine-color-gray-1)", color: isOwn ? "white" : "inherit" }}><Text size="xs" fw={700}>{item.sender?.name || "Участник сделки"}</Text><Text size="sm">{item.content}</Text><Text size="10px" c={isOwn ? "rgba(255,255,255,.62)" : "dimmed"} mt={2}>{formatDateTime(item.createdAt)}</Text></Box></Group>
}

function Participant({ label, user, empty }: { label: string; user?: DeliveryUser | null; empty?: string }) {
  const organization = user?.deliveryOrganizations?.[0]
  return <Group gap="xs"><Avatar size="sm" radius="xl" src={user?.image}>{user?.name?.[0]?.toUpperCase()}</Avatar><Stack gap={0}><Text size="10px" c="dimmed">{label}</Text><Group gap={5}><Text size="xs" fw={600}>{organization?.legalName || user?.name || empty || "Не указан"}</Text>{organization && <IconShieldCheck size={13} color="#059669" aria-label="Организация проверена" />}</Group></Stack></Group>
}

function PaymentTerm({ label, amount, status }: { label: string; amount: number; status: string }) {
  const meta = paymentStatusMeta[status] || { label: "Счёт ещё не выставлен", color: "gray" }
  return <Group justify="space-between" align="center" gap="sm" wrap="nowrap"><Stack gap={0}><Text size="xs" c="dimmed">{label}</Text><Text fw={800}>{amount.toLocaleString("ru-RU")} ₽</Text></Stack><Badge variant="light" color={meta.color}>{meta.label}</Badge></Group>
}

function EmptyText({ text }: { text: string }) { return <Text size="sm" c="dimmed">{text}</Text> }
function formatDate(value?: string | Date | null) { return value ? new Date(value).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" }) : "уточняется" }
function formatDateTime(value?: string | Date | null) { return value ? new Date(value).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "" }
function formatBytes(size: number) { return size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} КБ` : `${(size / 1024 / 1024).toFixed(1)} МБ` }
function currencySymbol(currency: string) { return ({ RUB: "₽", CNY: "¥", KRW: "₩", JPY: "¥", USD: "$", EUR: "€" } as Record<string, string>)[currency] || currency }
function sourceLabel(source?: string) { return ({ MANUAL: "ручное подтверждение", PARTNER: "партнёр", BROKER: "брокер", OFFICIAL_API: "официальный канал" } as Record<string, string>)[source || ""] || "уточняется" }
