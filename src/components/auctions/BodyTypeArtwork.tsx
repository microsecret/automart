import Image from "next/image"
import { IconCar } from "@tabler/icons-react"
import styles from "./body-type-artwork.module.css"

const artwork: Record<string, string> = {
  SEDAN: "sedan", HATCHBACK: "hatchback", SUV: "suv", WAGON: "wagon",
  COUPE: "coupe", PICKUP: "pickup", MINIVAN: "minivan",
}

/** Decorative body identity, never a substitute for a lot's actual photos. */
export default function BodyTypeArtwork({ bodyType }: { bodyType: string }) {
  const name = artwork[bodyType]
  return <span className={styles.frame} aria-hidden="true">
    {name ? <picture>
      <source srcSet={`/images/ui/body-v1/${name}-120.webp 1x, /images/ui/body-v1/${name}-240.webp 2x`} />
      <Image src={`/images/ui/body-v1/${name}-240.webp`} width={112} height={68} alt="" unoptimized draggable={false} loading="lazy" className={styles.image} />
    </picture> : <IconCar size={24} />}
  </span>
}
