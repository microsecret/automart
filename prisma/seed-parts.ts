import { PrismaClient } from "@prisma/client"
import partsData from "./parts-data.json"
const prisma = new PrismaClient()
const C = ["Москва","Санкт-Петербург","Екатеринбург","Казань","Краснодар"]
function ri(a:number,b:number){return Math.floor(Math.random()*(b-a+1))+a}
function pk(a:any[]){return a[Math.floor(Math.random()*a.length)]}

async function main() {
  const user = await prisma.user.findFirst({})
  if (!user) { console.error("No user"); return }
  let created = 0
  for (const p of partsData as any[]) {
    const ex = await prisma.part.findFirst({ where: { oemNumber: p.oem } }).catch(() => null)
    if (ex) continue
    const part = await prisma.part.create({
      data: {
        name: p.name,
        description: p.d,
        price: p.price,
        condition: p.cond,
        partType: p.t,
        make: p.compat[0].make,
        model: p.compat[0].model,
        yearFrom: p.compat[0].yf || null,
        yearTo: p.compat[0].yt || null,
        location: pk(C),
        images: JSON.stringify(["https://cdn.automart.ru/parts/" + p.t.toLowerCase() + "-" + ri(1,5) + ".jpg"]),
        userId: user.id,
        keywords: p.name + " " + p.oem,
        subcategory: p.sub,
        oemNumber: p.oem,
        compatibility: { create: p.compat.map((c:any) => ({
          make: c.make, model: c.model, generation: c.gen || null,
          yearFrom: c.yf || null, yearTo: c.yt || null, engine: c.eng || null,
        }))},
      } as any,
    })
    await prisma.listing.create({
      data: { title: p.name, description: p.d, price: p.price, userId: user.id, partId: part.id, views: ri(10, 200) },
    })
    created++
  }
  console.log("Created " + created + " parts")
}
main().catch(console.error).finally(() => prisma.$disconnect())
