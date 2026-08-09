"use client"

import { useState } from "react"
import useSWR from "swr"
import { Box, Stack, Text, Group, Center, Loader, Pagination, SimpleGrid, Card, ThemeIcon, TextInput, Image, Badge } from "@mantine/core"
import { IconNews, IconClock, IconMessageCircle2, IconSearch } from "@tabler/icons-react"
import Link from "next/link"
import { formatRelativeDate } from "@/lib/format"
import { newsHref } from "@/lib/news"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function NewsListClient() {
  const [page, setPage] = useState(1)
  const [q, setQ] = useState("")
  const { data, isLoading } = useSWR<{ news: any[]; pagination: any }>(`/api/news?page=${page}&limit=12${q ? `&q=${encodeURIComponent(q)}` : ""}`, fetcher)

  return (
    <Box p={{ base: "sm", md: "md" }}>
      <Stack gap="md">
        <Group gap="sm" align="center">
          <ThemeIcon variant="light" color="indigo" size={40} radius="md"><IconNews size={20} /></ThemeIcon>
          <Stack gap={0}>
            <Text component="h1" ff="var(--font-display),sans-serif" fw={800} fz={{ base: 22, md: 26 }} c="dark.9">Автомобильные новости</Text>
            <Text size="xs" c="gray.5">{data?.pagination?.total || "—"} публикаций редакции и рынка</Text>
          </Stack>
        </Group>

        <TextInput placeholder="Поиск по новостям..." leftSection={<IconSearch size={16} />} value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} size="sm" radius="md" mb="sm" />

        {isLoading ? (
          <Center py={60}><Loader color="indigo" size="sm" /></Center>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
            {(data?.news || []).map((article) => (
              <Link key={article.id} href={newsHref(article)} style={{ textDecoration: "none", color: "inherit" }}>
                <Card withBorder radius="md" p="sm" style={{ borderColor: "var(--mantine-color-border)", height: "100%", transition: "all 200ms ease", cursor: "pointer", overflow: "hidden" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#e4e4e7"; e.currentTarget.style.boxShadow = "0 8px 18px -10px rgba(0,0,0,0.18)" }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#f4f4f5"; e.currentTarget.style.boxShadow = "none" }}>
                  <Stack gap="xs" style={{ height: "100%", justifyContent: "space-between" }}>
                    {article.imageUrl && (
                      <Image src={article.imageUrl} alt={article.title} h={150} radius="sm" fit="cover" fallbackSrc="/images/home/hero-marketplace.png" />
                    )}
                    <Group justify="space-between" gap="xs">
                      {article.sourceChannel && <Badge size="xs" variant="light" color="indigo">@{article.sourceChannel}</Badge>}
                      <Text size="xs" c="gray.4">{formatRelativeDate(article.publishedAt)}</Text>
                    </Group>
                    <Text size="sm" fw={650} c="dark.9" lh={1.3} style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {article.title}
                    </Text>
                    {article.excerpt && (
                      <Text size="xs" c="gray.5" lh={1.4} style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {article.excerpt}
                      </Text>
                    )}
                    <Group gap="xs" mt="auto" pt="xs" style={{ borderTop: "1px solid var(--mantine-color-border)" }}>
                      <Group gap={3}>
                        <IconClock size={11} stroke={1.8} color="gray.4" />
                        <Text size="xs" c="gray.4">{formatRelativeDate(article.publishedAt)}</Text>
                      </Group>
                      {article._count?.comments > 0 && (
                        <Group gap={3}>
                          <IconMessageCircle2 size={11} stroke={1.8} color="gray.4" />
                          <Text size="xs" c="gray.4">{article._count.comments}</Text>
                        </Group>
                      )}
                    </Group>
                  </Stack>
                </Card>
              </Link>
            ))}
          </SimpleGrid>
        )}

        {data && data.pagination.pages > 1 && (
          <Group justify="center" mt="md">
            <Pagination value={page} onChange={setPage} total={data.pagination.pages} color="indigo" radius="md" size="sm" />
          </Group>
        )}
      </Stack>
    </Box>
  )
}
