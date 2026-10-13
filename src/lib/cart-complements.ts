/**
 * Что пригодится вместе с товаром — правила по товарным группам.
 *
 * Пока совместных покупок мало, подсказка строится из того, что механик и
 * так докупает при работе: к маслу — фильтр, к колодкам — диски и
 * жидкость. Причина пишется явно, чтобы подборка не выглядела случайной.
 * Когда в базе появятся настоящие совместные заказы, они идут первыми
 * под заголовком «С этим товаром покупают».
 */
export const COMPLEMENTS: Readonly<Record<string, ReadonlyArray<{ group: string; reason: string }>>> = {
  engine_oil: [
    { group: "oil_filter", reason: "Масло меняют вместе с фильтром" },
    { group: "air_filter", reason: "Обычно меняют на том же ТО" },
    { group: "autochem", reason: "Промывка перед заменой" },
  ],
  oil_filter: [
    { group: "engine_oil", reason: "Фильтр меняют вместе с маслом" },
    { group: "air_filter", reason: "Обычно меняют на том же ТО" },
  ],
  air_filter: [
    { group: "cabin_filter", reason: "Меняют вместе на ТО" },
    { group: "oil_filter", reason: "Обычно меняют на том же ТО" },
  ],
  cabin_filter: [
    { group: "air_filter", reason: "Меняют вместе на ТО" },
    { group: "autochem", reason: "Очиститель кондиционера" },
  ],
  fuel_filter: [{ group: "autochem", reason: "Очиститель топливной системы" }],
  brake_pads: [
    { group: "brake_discs", reason: "Изношенные диски съедают новые колодки" },
    { group: "brake_fluid", reason: "Жидкость меняют раз в 2 года" },
  ],
  brake_discs: [
    { group: "brake_pads", reason: "Новые диски ставят с новыми колодками" },
    { group: "brake_fluid", reason: "Жидкость меняют раз в 2 года" },
  ],
  brake_fluid: [{ group: "brake_pads", reason: "Часто меняют вместе" }],
  battery: [
    { group: "tools", reason: "Зарядное и пусковое устройство" },
    { group: "autochem", reason: "Смазка для клемм" },
  ],
  tires: [
    { group: "wheels", reason: "Диски под этот размер" },
    { group: "autochem", reason: "Средства для шин" },
  ],
  wheels: [{ group: "tires", reason: "Шины под этот диаметр" }],
  wiper_blades: [{ group: "washer_fluid", reason: "Омыватель для бачка" }],
  washer_fluid: [{ group: "wiper_blades", reason: "Щётки для чистого стекла" }],
  antifreeze: [{ group: "autochem", reason: "Промывка системы охлаждения" }],
  transmission_oil: [{ group: "autochem", reason: "Промывка коробки" }],
  spark_plugs: [
    { group: "air_filter", reason: "Меняют на том же ТО" },
    { group: "autochem", reason: "Очиститель инжектора" },
  ],
  bulbs: [{ group: "bulbs", reason: "Лампы меняют парой" }],
  shock_absorbers: [{ group: "shock_absorbers", reason: "Амортизаторы меняют парой на оси" }],
}
