import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { makeSeoDescription, newsHref } from "@/lib/news"
import { absoluteUrl } from "@/lib/site-url"
import NewsDetailClient, { type NewsArticle } from "./NewsDetailClient"

type PageProps = { params: Promise<{ id: string }> }

async function getNewsMetadata(id: string) {
  return prisma.news.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      imageUrl: true,
      sourceUrl: true,
      telegramUrl: true,
      author: true,
      seoTitle: true,
      seoDescription: true,
      publishedAt: true,
      updatedAt: true,
    },
  })
}

async function getNewsArticle(id: string) {
  return prisma.news.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    select: {
      id: true,
      slug: true,
      title: true,
      content: true,
      excerpt: true,
      imageUrl: true,
      sourceChannel: true,
      sourceUrl: true,
      telegramUrl: true,
      tags: true,
      author: true,
      seoTitle: true,
      seoDescription: true,
      publishedAt: true,
      updatedAt: true,
      views: true,
      comments: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          content: true,
          createdAt: true,
          user: { select: { id: true, name: true, image: true } },
        },
      },
    },
  })
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const news = await getNewsMetadata(id)
  if (!news) return { title: "Новость не найдена", robots: { index: false, follow: false } }

  const title = news.seoTitle || news.title
  const description = news.seoDescription || makeSeoDescription(news.excerpt || news.title)
  const canonical = newsHref(news)

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "article",
      title,
      description,
      url: absoluteUrl(canonical),
      publishedTime: news.publishedAt.toISOString(),
      modifiedTime: news.updatedAt.toISOString(),
      authors: news.author ? [news.author] : undefined,
      images: news.imageUrl ? [{ url: news.imageUrl, alt: news.title }] : undefined,
    },
    twitter: { card: "summary_large_image", title, description, images: news.imageUrl ? [news.imageUrl] : undefined },
  }
}

export default async function NewsDetailPage({ params }: PageProps) {
  const { id } = await params
  const news = await getNewsArticle(id)
  if (!news) notFound()

  const canonical = absoluteUrl(newsHref(news))
  const initialArticle: NewsArticle = {
    id: news.id,
    title: news.title,
    content: news.content,
    imageUrl: news.imageUrl,
    sourceChannel: news.sourceChannel,
    sourceUrl: news.sourceUrl,
    telegramUrl: news.telegramUrl,
    tags: news.tags,
    publishedAt: news.publishedAt.toISOString(),
    views: news.views,
    comments: news.comments.map((comment) => ({
      ...comment,
      createdAt: comment.createdAt.toISOString(),
    })),
  }
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: news.title,
    description: news.seoDescription || makeSeoDescription(news.excerpt || news.title),
    datePublished: news.publishedAt.toISOString(),
    dateModified: news.updatedAt.toISOString(),
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    image: news.imageUrl ? [news.imageUrl] : undefined,
    author: news.author ? { "@type": "Person", name: news.author } : { "@type": "Organization", name: "LeWheel" },
    publisher: { "@type": "Organization", name: "LeWheel", url: absoluteUrl() },
    isBasedOn: news.sourceUrl || news.telegramUrl || undefined,
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <NewsDetailClient id={id} initialArticle={initialArticle} />
    </>
  )
}
