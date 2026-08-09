import { Container } from "@mantine/core"
import { AsyncErrorState } from "@/components/ui/AsyncStates"

export default function NotFoundPage() {
  return (
    <Container size="sm" py={{ base: 64, md: 112 }}>
      <AsyncErrorState
        title="Такой страницы нет"
        description="Возможно, объявление снято с публикации или ссылка устарела."
        backHref="/"
      />
    </Container>
  )
}
