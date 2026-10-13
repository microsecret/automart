"use client"
export const dynamic = "force-dynamic"

import { Suspense, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import useSWR from "swr"
import { Button, Center, Checkbox, Drawer, Loader, Pagination, Select, TextInput, UnstyledButton } from "@mantine/core"
import { IconAdjustmentsHorizontal, IconArrowRight, IconSearch, IconX } from "@tabler/icons-react"
import { PART_SUBCATEGORIES, PART_TYPES } from "@/lib/constants"
import { getBrandsByCategory, getModels } from "@/lib/catalog"
import { parseImages } from "@/lib/format"
import { fetchJson } from "@/lib/api-client"
import { DEPARTMENTS, PRODUCT_GROUP_BY_KEY, productGroupsOfDepartment, productGroupBySubcategory, type DepartmentKey } from "@/lib/product-groups"
import { articleHref, looksLikeArticle } from "@/lib/article-number"
import ShopBar from "@/components/catalogs/ShopBar"
import PartOfferCard from "@/components/catalogs/PartOfferCard"
import DepartmentNav from "@/components/parts/DepartmentNav"
import PartFacetsPanel, { type Facet } from "@/components/parts/PartFacetsPanel"
import PartRequestPrompt from "@/components/parts/PartRequestPrompt"
import { AsyncErrorState } from "@/components/ui/AsyncStates"
import SaveSearchButton from "@/components/search/SaveSearchButton"
import catalog from "@/components/catalogs/catalogs.module.css"
import styles from "./finder.module.css"

type PartResult = {
  id: string
  name: string
  price: number
  images: string | null
  oemNumber: string | null
  brandName: string | null
  supplyMode: string
  leadTimeDaysMin: number | null
  leadTimeDaysMax: number | null
  location: string | null
  storeId: string | null
  summary?: string
  store?: { name: string; slug: string; city: string | null } | null
}

type PartsResponse = {
  parts: PartResult[]
  pagination: { total: number; pages: number; limit: number; catalogTotal?: number; activeStores?: number }
  group?: { key: string; label: string }
  facets?: Facet[]
  brands?: Array<{ value: string; count: number }>
}

const PAGE_SIZE = 24
const SORTS = [
  { value: "newest", label: "Новые" },
  { value: "price_asc", label: "Дешевле" },
  { value: "price_desc", label: "Дороже" },
]
const CAR_BRANDS = getBrandsByCategory("cars").map((brand) => brand.name)

function goods(total: number) {
  const lastTwo = total % 100
  const last = total % 10
  if (lastTwo >= 11 && lastTwo <= 14) return `${total} товаров`
  if (last === 1) return `${total} товар`
  if (last >= 2 && last <= 4) return `${total} товара`
  return `${total} товаров`
}

const list = (value: string | null) => Array.from(new Set((value || "").split(",").map((item) => item.trim()).filter(Boolean)))

/**
 * Поиск запчастей и автотоваров в раскладке автомагазина.
 *
 * Состояние фильтров живёт только в адресе страницы: одна правда вместо
 * двух эффектов, которые раскладывали адрес в состояния и собирали
 * обратно, — прежняя страница теряла параметры, когда запись опережала
 * чтение. Слева одна колонка фильтров (машина, производитель, цена,
 * наличие, состояние, характеристики группы), справа поиск, сортировка,
 * активные фильтры и карточки — как у autodoc и avtovek.
 */
function PartsContent() {
  const sp = useSearchParams()
  const router = useRouter()
  const key = sp.toString()
  const params = useMemo(() => new URLSearchParams(key), [key])

  const update = (patch: Record<string, string | null>, keepPage = false) => {
    const next = new URLSearchParams(key)
    for (const [name, value] of Object.entries(patch)) {
      if (value) next.set(name, value)
      else next.delete(name)
    }
    if (!keepPage) next.delete("page")
    const query = next.toString()
    router.replace(query ? `/parts-finder?${query}` : "/parts-finder", { scroll: false })
  }

  const groupKey = PRODUCT_GROUP_BY_KEY.has(params.get("group") || "") ? params.get("group") : null
  const partType = PART_TYPES.some((item) => item.value === params.get("partType")) ? params.get("partType") : null
  const subcategory = partType && (PART_SUBCATEGORIES[partType] || []).includes(params.get("subcategory") || "") ? params.get("subcategory") : null
  const group = (groupKey ? PRODUCT_GROUP_BY_KEY.get(groupKey) : null) ?? productGroupBySubcategory(subcategory)
  const department = (group?.department ?? (DEPARTMENTS.some((item) => item.key === params.get("dept")) ? params.get("dept") : null)) as DepartmentKey | null
  const make = params.get("make")
  const model = params.get("model")
  const brands = list(params.get("brand"))
  const availability = list(params.get("availability"))
  const conditions = list(params.get("conditions") || params.get("condition"))
  const sort = SORTS.some((item) => item.value === params.get("sort")) ? (params.get("sort") as string) : "newest"
  const page = Math.max(1, Number(params.get("page")) || 1)
  const attrs: Record<string, string> = {}
  params.forEach((value, name) => { if (name.startsWith("a_") && value) attrs[name.slice(2)] = value })

  /* Поле поиска — с паузой: запрос уходит не на каждую букву. */
  const [q, setQ] = useState(params.get("q") || "")
  useEffect(() => { setQ(params.get("q") || "") }, [params])
  useEffect(() => {
    const timer = window.setTimeout(() => { if ((params.get("q") || "") !== q.trim()) update({ q: q.trim() || null }) }, 400)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const [priceFrom, setPriceFrom] = useState(params.get("priceFrom") || "")
  const [priceTo, setPriceTo] = useState(params.get("priceTo") || "")
  useEffect(() => { setPriceFrom(params.get("priceFrom") || ""); setPriceTo(params.get("priceTo") || "") }, [params])
  const applyPrice = () => update({ priceFrom: priceFrom.replace(/\D/g, "") || null, priceTo: priceTo.replace(/\D/g, "") || null })

  const apiQuery = useMemo(() => {
    const query = new URLSearchParams(key)
    query.set("limit", String(PAGE_SIZE))
    query.set("facets", "1")
    if (make) query.set("compatible", "true")
    query.delete("dept")
    return query.toString()
  }, [key, make])
  const { data, error, isLoading, mutate } = useSWR<PartsResponse>(`/api/parts?${apiQuery}`, fetchJson, { keepPreviousData: true })

  const [filtersOpen, setFiltersOpen] = useState(false)
  const [showAllBrands, setShowAllBrands] = useState(false)

  const toggle = (name: string, values: string[], value: string) => {
    const next = values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
    update({ [name]: next.length ? next.join(",") : null })
  }

  const activeChips: Array<{ label: string; clear: Record<string, string | null> }> = [
    ...(make ? [{ label: `${make}${model ? ` ${model}` : ""}`, clear: { make: null, model: null } }] : []),
    ...brands.map((brand) => ({ label: brand, clear: { brand: brands.filter((item) => item !== brand).join(",") || null } })),
    ...(params.get("priceFrom") || params.get("priceTo") ? [{ label: `Цена ${params.get("priceFrom") ? `от ${params.get("priceFrom")}` : ""}${params.get("priceTo") ? ` до ${params.get("priceTo")}` : ""} ₽`, clear: { priceFrom: null, priceTo: null } }] : []),
    ...availability.map((value) => ({ label: value === "ON_ORDER" ? "Под заказ" : "В наличии", clear: { availability: availability.filter((item) => item !== value).join(",") || null } })),
    ...conditions.map((value) => ({ label: value === "USED" ? "Б/у" : "Новые", clear: { conditions: conditions.filter((item) => item !== value).join(",") || null, condition: null } })),
    ...(subcategory ? [{ label: subcategory, clear: { subcategory: null } }] : []),
    ...Object.entries(attrs).map(([attrKey, value]) => {
      const def = group?.attributes.find((item) => item.key === attrKey)
      return { label: `${def?.label ?? attrKey}: ${value.replace("..", "–").split("|").join(", ")}`, clear: { [`a_${attrKey}`]: null } }
    }),
  ]
  const resetFilters = () => {
    const keep = new URLSearchParams()
    if (groupKey) keep.set("group", groupKey)
    if (partType && !groupKey) keep.set("partType", partType)
    router.replace(keep.toString() ? `/parts-finder?${keep}` : "/parts-finder", { scroll: false })
  }

  const parts = data?.parts ?? []
  const total = data?.pagination?.total ?? 0
  const catalogEmpty = data ? (data.pagination.catalogTotal ?? total) === 0 : false
  const searching = Boolean(params.get("q") || make || partType || group)
  const title = group?.label ?? (partType ? PART_TYPES.find((item) => item.value === partType)?.label : null) ?? (params.get("q") ? `Поиск: «${params.get("q")}»` : "Запчасти и автотовары")
  const departmentLabel = department ? DEPARTMENTS.find((item) => item.key === department)?.label : null

  const filters = (
    <div className={styles.filters}>
      <section className={styles.filterSection}>
        <h3>Автомобиль</h3>
        <Select placeholder="Марка" data={CAR_BRANDS} searchable clearable value={make} onChange={(value) => update({ make: value, model: null })} size="sm" />
        <Select placeholder={make ? "Любая модель" : "Сначала марка"} data={make ? getModels(make, "cars") : []} searchable clearable disabled={!make} value={model} onChange={(value) => update({ model: value })} size="sm" />
        <Link href="/catalogs" className={styles.filterLink}>Каталог по маркам и VIN <IconArrowRight size={14} /></Link>
      </section>

      {(data?.brands?.length || brands.length) ? (
        <section className={styles.filterSection}>
          <h3>Производитель</h3>
          <div className={styles.checkList}>
            {[...brands.filter((brand) => !data?.brands?.some((item) => item.value === brand)).map((value) => ({ value, count: 0 })), ...(data?.brands ?? [])]
              .slice(0, showAllBrands ? 60 : 8)
              .map((item) => (
                <Checkbox
                  key={item.value}
                  size="sm"
                  checked={brands.includes(item.value)}
                  onChange={() => toggle("brand", brands, item.value)}
                  label={<span className={styles.checkLabel}><span>{item.value}</span>{item.count > 0 && <small>{item.count}</small>}</span>}
                />
              ))}
          </div>
          {(data?.brands?.length ?? 0) > 8 && (
            <UnstyledButton className={styles.filterLink} onClick={() => setShowAllBrands((value) => !value)}>
              {showAllBrands ? "Свернуть" : `Все производители (${data?.brands?.length})`}
            </UnstyledButton>
          )}
        </section>
      ) : null}

      <section className={styles.filterSection}>
        <h3>Цена, ₽</h3>
        <div className={styles.priceRow}>
          <TextInput size="sm" placeholder="от" inputMode="numeric" value={priceFrom} onChange={(event) => setPriceFrom(event.currentTarget.value)} onBlur={applyPrice} onKeyDown={(event) => { if (event.key === "Enter") applyPrice() }} aria-label="Цена от" />
          <TextInput size="sm" placeholder="до" inputMode="numeric" value={priceTo} onChange={(event) => setPriceTo(event.currentTarget.value)} onBlur={applyPrice} onKeyDown={(event) => { if (event.key === "Enter") applyPrice() }} aria-label="Цена до" />
        </div>
      </section>

      <section className={styles.filterSection}>
        <h3>Наличие</h3>
        <div className={styles.checkList}>
          <Checkbox size="sm" label="В наличии" checked={availability.includes("IN_STOCK")} onChange={() => toggle("availability", availability, "IN_STOCK")} />
          <Checkbox size="sm" label="Под заказ" checked={availability.includes("ON_ORDER")} onChange={() => toggle("availability", availability, "ON_ORDER")} />
        </div>
      </section>

      <section className={styles.filterSection}>
        <h3>Состояние</h3>
        <div className={styles.checkList}>
          <Checkbox size="sm" label="Новые" checked={conditions.includes("NEW")} onChange={() => toggle("conditions", conditions, "NEW")} />
          <Checkbox size="sm" label="Б/у" checked={conditions.includes("USED")} onChange={() => toggle("conditions", conditions, "USED")} />
        </div>
      </section>

      {!group && (
        <section className={styles.filterSection}>
          <h3>Узел</h3>
          <Select placeholder="Любой" data={PART_TYPES.map((item) => ({ value: item.value, label: item.label }))} clearable value={partType} onChange={(value) => update({ partType: value, subcategory: null })} size="sm" />
          {partType && (PART_SUBCATEGORIES[partType] || []).length > 0 && (
            <Select placeholder="Уточнить" data={PART_SUBCATEGORIES[partType]} clearable searchable value={subcategory} onChange={(value) => update({ subcategory: value })} size="sm" />
          )}
        </section>
      )}

      {group && data?.facets && data.facets.length > 0 && (
        <section className={styles.filterSection}>
          <h3>Характеристики</h3>
          <PartFacetsPanel
            bare
            title={group.label}
            facets={data.facets}
            values={attrs}
            onChange={(attrKey, value) => update({ [`a_${attrKey}`]: value })}
            onReset={() => update(Object.fromEntries(Object.keys(attrs).map((name) => [`a_${name}`, null])))}
          />
        </section>
      )}

      {activeChips.length > 0 && <Button variant="subtle" color="gray" size="sm" onClick={resetFilters}>Сбросить фильтры</Button>}
    </div>
  )

  return (
    <main className={catalog.page}>
      <ShopBar />

      <nav className={catalog.crumbs} aria-label="Навигация">
        <Link href="/">Главная</Link>
        <span aria-hidden="true">›</span>
        <Link href="/parts-finder">Запчасти</Link>
        {departmentLabel && (
          <>
            <span aria-hidden="true">›</span>
            {group ? <Link href={`/parts-finder?dept=${department}`}>{departmentLabel}</Link> : <span aria-current="page">{departmentLabel}</span>}
          </>
        )}
        {group && <><span aria-hidden="true">›</span><span aria-current="page">{group.label}</span></>}
      </nav>

      <header className={catalog.pageHead}>
        <h1 className={catalog.titleDark}>
          {title}
          {data && total > 0 && <> <span className={catalog.titleCount}>{goods(total)}</span></>}
        </h1>
        {params.get("q") && looksLikeArticle(params.get("q") as string) && (
          <Link href={articleHref(params.get("q") as string)} className="parts-article-link">
            Все предложения и аналоги по номеру <b>{(params.get("q") as string).toUpperCase()}</b> <IconArrowRight size={15} aria-hidden="true" />
          </Link>
        )}
      </header>

      {/* Плитки отделов — на входе в раздел. В выбранной группе вместо них
          строка соседних групп: тот же переход, а места втрое меньше. */}
      {!group ? (
        <DepartmentNav
          group={null}
          department={department}
          onSelect={(next) => update({ dept: next.group ? null : next.department, group: next.group, partType: null, subcategory: null })}
        />
      ) : (
        <nav className={styles.siblings} aria-label={`Отдел «${departmentLabel}»`}>
          <Link href={`/parts-finder?dept=${group.department}`} className={styles.siblingAll}>← {departmentLabel}</Link>
          {productGroupsOfDepartment(group.department).map((item) => (
            <Link key={item.key} href={`/parts-finder?group=${item.key}`} className={styles.sibling} aria-current={item.key === group.key ? "true" : undefined}>
              {item.label}
            </Link>
          ))}
        </nav>
      )}

      <div className={catalog.shopLayout}>
        <aside className={`${catalog.sidebar} ${styles.sidebar}`} aria-label="Фильтры">{filters}</aside>

        <div className={catalog.shopMain}>
          <div className={styles.toolbar}>
            <TextInput
              className={styles.search}
              leftSection={<IconSearch size={16} />}
              placeholder={group ? `Поиск в разделе «${group.label}»` : "Название, артикул или аналог"}
              value={q}
              onChange={(event) => setQ(event.currentTarget.value)}
              aria-label="Поиск запчастей"
            />
            <Button className={styles.filtersButton} variant="default" leftSection={<IconAdjustmentsHorizontal size={16} />} onClick={() => setFiltersOpen(true)}>
              Фильтры{activeChips.length ? ` · ${activeChips.length}` : ""}
            </Button>
            {/* Подписка на раздел с фильтрами: магазины подключаются, и
                «сообщить о поступлении» превращает пустую страницу в спрос. */}
            {searching && <SaveSearchButton scope="PARTS" suggestedTitle={[group?.label, make, model, brands.join(", ")].filter(Boolean).join(" · ") || undefined} />}
            <nav className={catalog.articleSort} aria-label="Сортировка">
              {SORTS.map((item) => (
                <button key={item.value} type="button" className={styles.sortButton} aria-current={sort === item.value ? "true" : undefined} onClick={() => update({ sort: item.value === "newest" ? null : item.value })}>
                  {item.label}
                </button>
              ))}
            </nav>
          </div>

          {activeChips.length > 0 && (
            <div className={styles.chips}>
              {activeChips.map((chip) => (
                <button key={chip.label} type="button" className={styles.chip} onClick={() => update(chip.clear)}>
                  {chip.label} <IconX size={13} aria-hidden="true" />
                </button>
              ))}
            </div>
          )}

          {error ? (
            <AsyncErrorState title="Не удалось загрузить товары" description="Каталог временно не отвечает. Попробуйте обновить выдачу." onRetry={() => mutate()} />
          ) : isLoading && !data ? (
            <div className={catalog.offerGrid} aria-busy="true">
              {Array.from({ length: 6 }).map((_, index) => <div key={index} className={styles.skeleton} />)}
            </div>
          ) : parts.length > 0 ? (
            <div className={`${catalog.offerGrid} ${isLoading ? styles.refreshing : ""}`}>
              {parts.map((part) => (
                <PartOfferCard
                  key={part.id}
                  offer={{
                    id: part.id, name: part.name, price: part.price,
                    image: parseImages(part.images)[0] || null,
                    oemNumber: part.oemNumber, brandName: part.brandName,
                    storeName: part.store?.name ?? null, location: part.location,
                    supplyMode: part.supplyMode, leadTimeDaysMin: part.leadTimeDaysMin, leadTimeDaysMax: part.leadTimeDaysMax,
                    summary: part.summary, canBuy: Boolean(part.storeId),
                  }}
                />
              ))}
            </div>
          ) : (
            <section className={styles.empty}>
              {activeChips.length > 0 && !catalogEmpty ? (
                <>
                  <h2 className={catalog.h2}>По этим фильтрам ничего нет</h2>
                  <p className={catalog.muted}>Уберите часть фильтров — например, производителя или цену.</p>
                  <Button variant="light" color="indigo" onClick={resetFilters}>Сбросить фильтры</Button>
                </>
              ) : (
                <>
                  <h2 className={catalog.h2}>{group ? `В разделе «${group.label}» пока нет товаров` : searching ? "Ничего не нашлось" : "Каталог наполняется"}</h2>
                  <p className={catalog.muted}>
                    {group
                      ? "Магазины подключаются к площадке. Если товар нужен сейчас — оставьте заявку, а продавцам — откройте магазин."
                      : "Попробуйте другой запрос или выберите машину в каталоге по маркам."}
                  </p>
                  <div className={styles.emptyActions}>
                    <SaveSearchButton scope="PARTS" suggestedTitle={[group?.label, make, model].filter(Boolean).join(" · ") || undefined} />
                    <Link href="/sell" className={catalog.sellerButton}>{group ? `Продаёте ${group.label.toLowerCase()}? Откройте магазин` : "Открыть магазин"}</Link>
                    <Link href="/catalogs" className={styles.secondaryLink}>Каталог по маркам</Link>
                  </div>
                </>
              )}
            </section>
          )}

          {data && data.pagination.pages > 1 && (
            <Center>
              <Pagination value={page} onChange={(next) => { update({ page: String(next) }, true); window.scrollTo({ top: 0, behavior: "smooth" }) }} total={data.pagination.pages} siblings={1} boundaries={1} color="indigo" />
            </Center>
          )}

          <PartRequestPrompt activeStores={data?.pagination?.activeStores ?? 0} />
        </div>
      </div>

      <Drawer opened={filtersOpen} onClose={() => setFiltersOpen(false)} position="bottom" size="88%" title="Фильтры" radius="lg">
        {filters}
        <Button fullWidth mt="md" color="indigo" onClick={() => setFiltersOpen(false)}>
          Показать {data ? goods(total) : "товары"}
        </Button>
      </Drawer>
    </main>
  )
}

export default function PartsFinderPage() {
  return (
    <Suspense fallback={<Center py={80}><Loader size="sm" color="indigo" /></Center>}>
      <PartsContent />
    </Suspense>
  )
}
