"use client"
import { useState } from "react"
import VehicleFallback from "@/components/listings/VehicleFallback"
import styles from "./auction-similar-media.module.css"

/** Real source photos only; failure state is scoped to the requested URL. */
export default function AuctionSimilarMedia({ src, alt }: { src?: string | null; alt: string }) {
  const [failedSource, setFailedSource] = useState<string | null>(null)
  const failed = Boolean(src) && failedSource === src
  const label = failed ? "Фото недоступно" : "Фото не добавлено"
  return <div className={styles.frame} data-similar-media-state={src && !failed ? "photo" : failed ? "unavailable" : "missing"}>
    {src && !failed ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img key={src} src={src} width={300} height={150} alt={alt} referrerPolicy="no-referrer" loading="lazy" decoding="async" className={styles.image} onError={() => setFailedSource(src)} />
    ) : <>
      <VehicleFallback type="CAR" compact label={`${alt}. ${label}`} />
      <span className={styles.status}>{label}</span>
    </>}
  </div>
}
