import Image from "next/image"
import type { ReactNode } from "react"

export default function PartWorkshopBanner({ scene, title, children }: {
  scene: string
  title: string
  children: ReactNode
}) {
  const image = `/images/ui/parts-panorama-v1/${scene}`
  const overview = scene === "overview"

  return (
    <header className="part-category__heading" data-part-scene={scene}>
      <picture className="part-category__picture">
        <source media="(max-width: 40em)" srcSet={`${image}-840.webp`} />
        <source sizes={overview ? "(min-width: 90em) calc(100vw - 36rem), 100vw" : "(max-width: 56em) 100vw, 868px"}
          srcSet={`${image}-960.webp 960w, ${image}-1600.webp 1600w`} />
        <Image src={`${image}-1600.webp`} width={1600} height={overview ? 444 : 533} alt="" aria-hidden="true"
          unoptimized loading="eager" fetchPriority="high" className="part-category__scene" />
      </picture>
      <div className="part-category__hero-copy">
        <h1 className="part-category__title">{title}</h1>
        {children}
      </div>
    </header>
  )
}
