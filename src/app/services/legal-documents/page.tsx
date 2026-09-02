import { Alert, Box, Button, Group, Paper, SimpleGrid, Stack, Text, ThemeIcon } from "@mantine/core"
import { IconAlertCircle, IconArrowRight, IconCar, IconChecklist, IconFileDescription, IconMotorbike, IconShieldCheck, IconSignature } from "@tabler/icons-react"
import Link from "next/link"
import LegalDocumentBuilder from "@/components/services/LegalDocumentBuilder"

const DOCUMENTS = [
  {
    title: "Договор купли-продажи автомобиля",
    description: "Соберите данные продавца, покупателя и автомобиля до передачи денег и ключей.",
    icon: IconCar,
    color: "indigo",
    fields: ["Данные сторон и документы", "VIN, марка, модель, год", "Цена, порядок оплаты и дата передачи"],
  },
  {
    title: "Договор купли-продажи мототехники",
    description: "Та же понятная структура для мотоцикла, квадроцикла и другой техники с номерными агрегатами.",
    icon: IconMotorbike,
    color: "violet",
    fields: ["Паспортные данные сторон", "Марка, модель, VIN или номер рамы", "Комплектация и состояние на дату передачи"],
  },
  {
    title: "Акт приёма-передачи",
    description: "Зафиксируйте ключи, документы, пробег и видимые особенности, чтобы у сделки была понятная история.",
    icon: IconSignature,
    color: "teal",
    fields: ["Количество ключей и документов", "Показания одометра или моточасов", "Комплектация, замечания и подписи"],
  },
]

export default function LegalDocumentsPage() {
  return (
    <Box className="service-page" p={{ base: "sm", md: "md" }}>
      <Stack gap="lg">
        <Paper className="service-hub-hero" radius="xl" p={{ base: "lg", md: "xl" }} withBorder>
          <Group justify="space-between" align="flex-end" gap="lg" wrap="wrap">
            <Stack gap="xs" maw={700}>
              <Group gap="sm"><ThemeIcon size={42} radius="md" variant="white"><IconFileDescription size={21} /></ThemeIcon><Text c="white" fw={800} size="sm">ДОКУМЕНТЫ СДЕЛКИ</Text></Group>
              <Text component="h1" ff="var(--font-display),sans-serif">Подготовьте сделку спокойно и без пропущенных деталей.</Text>
              <Text size="sm" c="rgba(255,255,255,0.8)" maw={620}>Единый чек-лист для автомобиля, мототехники и передачи. Данные из объявления можно сверить перед встречей с продавцом.</Text>
            </Stack>
            <Button component={Link} href="/services/safe-deal" variant="white" color="dark" size="sm" rightSection={<IconArrowRight size={16} />}>Как проходит сделка</Button>
          </Group>
        </Paper>

        <Group gap="sm" align="center">
          <ThemeIcon size={38} radius="md" variant="light" color="indigo"><IconChecklist size={19} /></ThemeIcon>
          <Box><Text fw={800} fz="lg">Выберите основу документа</Text><Text size="sm" c="dimmed">Проверьте обязательные сведения и зафиксируйте фактическое состояние техники.</Text></Box>
        </Group>

        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
          {DOCUMENTS.map((document) => {
            const Icon = document.icon
            return <Paper key={document.title} withBorder radius="md" p="lg" className="service-card">
              <Stack gap="md" h="100%">
                <ThemeIcon size={44} radius="md" variant="light" color={document.color}><Icon size={22} /></ThemeIcon>
                <Box><Text fw={800} fz="lg">{document.title}</Text><Text size="sm" c="dimmed" mt={5} lh={1.45}>{document.description}</Text></Box>
                <Stack gap={7}>
                  {document.fields.map((field) => <Group key={field} gap={7} align="flex-start" wrap="nowrap">
                    <ThemeIcon color={document.color} size={17} radius="xl" variant="light" mt={2}><IconChecklist size={11} /></ThemeIcon>
                    <Text size="sm">{field}</Text>
                  </Group>)}
                </Stack>
                <Button component="a" href="#document-builder" mt="auto" variant="light" color={document.color}>Заполнить шаблон</Button>
              </Stack>
            </Paper>
          })}
        </SimpleGrid>

        <LegalDocumentBuilder />

        <Paper withBorder radius="md" p={{ base: "md", md: "lg" }}>
          <Group gap="sm" align="flex-start" wrap="nowrap">
            <ThemeIcon color="teal" variant="light" size={38} radius="md"><IconShieldCheck size={20} /></ThemeIcon>
            <Stack gap={4}><Text fw={800}>Перед подписанием</Text><Text size="sm" c="dimmed">Сверьте VIN или номер рамы с документами, проверьте полномочия продавца, внесите реальную цену и оформите акт приёма-передачи одновременно с расчётом.</Text></Stack>
          </Group>
        </Paper>

        <Alert color="yellow" variant="light" radius="lg" icon={<IconAlertCircle size={18} />}>
          <Text size="sm">Материалы — информационная основа для подготовки сделки, а не юридическая консультация. Перед подписанием сверяйте актуальные требования, обстоятельства сделки и при необходимости обращайтесь к юристу.</Text>
        </Alert>
      </Stack>
    </Box>
  )
}
