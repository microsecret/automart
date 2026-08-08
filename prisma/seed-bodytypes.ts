import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

const TYPE_BODIES: Record<string, [string, string][]> = {
  MOTORCYCLE: [
    ["Yamaha", "SPORT"], ["Kawasaki", "SPORT"], ["Suzuki", "SPORT"], ["Honda", "SPORT"], ["Ducati", "SPORT"],
    ["BMW Motorrad", "ADVENTURE"], ["KTM", "ENDURO"], ["Harley-Davidson", "CRUISER"], ["Triumph", "CRUISER"],
    ["Royal Enfield", "CRUISER"], ["Honda", "TOURING"], ["Yamaha", "NAKED"], ["Kawasaki", "NAKED"],
    ["Suzuki", "CROSS"],
  ],
  TRUCK: [
    ["Volvo Trucks", "TRACTOR"], ["Scania", "TRACTOR"], ["MAN", "TRACTOR"], ["Mercedes-Benz Trucks", "TRACTOR"],
    ["DAF", "TRACTOR"], ["КамАЗ", "DUMP"], ["МАЗ", "DUMP"], ["ГАЗ", "VAN"], ["Renault Trucks", "TENT"],
    ["Volvo Trucks", "TENT"], ["MAN", "FLATBED"], ["КамАЗ", "TANKER"], ["Mercedes-Benz Trucks", "REFRIGERATOR"],
  ],
  SPECIAL: [
    ["Komatsu", "EXCAVATOR"], ["Hitachi", "EXCAVATOR"], ["JCB", "LOADER"], ["Volvo CE", "LOADER"],
    ["XCMG", "BULLDOZER"], ["Liebherr", "CRANE"], ["Doosan", "EXCAVATOR"], ["Hyundai CE", "LOADER"],
    ["Komatsu", "BULLDOZER"], ["XCMG", "GRADER"], ["Hitachi", "ROLLER"],
  ],
  WATER: [
    ["Sea-Doo", "JETSKI"], ["Kawasaki Jet Ski", "JETSKI"], ["Bayliner", "BOAT"], ["MasterCraft", "BOAT"],
    ["Malibu", "BOAT"], ["Yamaha Marine", "BOAT"], ["Bennington", "CATAMARAN"], ["Sea-Doo", "WATERSCOOTER"],
    ["Bayliner", "YACHT"], ["MasterCraft", "YACHT"], ["Suzuki Marine", "RIB"],
  ],
  AIR: [
    ["Airbus Helicopters", "HELICOPTER"], ["Bell Helicopter", "HELICOPTER"], ["Robinson", "HELICOPTER"],
    ["Eurocopter", "HELICOPTER"], ["AgustaWestland", "HELICOPTER"], ["Mil", "HELICOPTER"], ["Kamov", "HELICOPTER"],
    ["Cessna", "AIRPLANE"], ["Piper", "AIRPLANE"], ["Beechcraft", "AIRPLANE"], ["McDonnell Douglas", "HELICOPTER"],
  ],
}

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }

async function main() {
  for (const [vtype, makeBodyPairs] of Object.entries(TYPE_BODIES)) {
    const vehicles = await prisma.vehicle.findMany({ where: { vehicleType: vtype } })
    console.log(`${vtype}: ${vehicles.length} vehicles`)
    for (const v of vehicles) {
      // Найти подходящий bodyType по марке или случайный
      const match = makeBodyPairs.find(([m]) => m === v.make)
      const bodyType = match ? match[1] : pick(makeBodyPairs)[1]
      await prisma.vehicle.update({ where: { id: v.id }, data: { bodyType } })
    }
  }
  console.log("Done!")
}

main().catch(console.error).finally(() => prisma.$disconnect())
