import type { Metadata } from "next"

type SeoMetadataInput = {
  title: string
  description: string
  canonical: string
  keywords?: string[]
  image?: string
}

/** One canonical social/search presentation for every public landing page. */
/** Картинка ссылки, когда своей у страницы нет. */
export const DEFAULT_SOCIAL_IMAGE = "/images/home/automarket-hero.png"

export function buildSeoMetadata({ title, description, canonical, keywords, image = DEFAULT_SOCIAL_IMAGE }: SeoMetadataInput): Metadata {
  return {
    title,
    description,
    keywords,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      locale: "ru_RU",
      siteName: "LeWheel",
      title,
      description,
      url: canonical,
      images: [{ url: image, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  }
}
