const IAUTOS_MODEL_TERMS: ReadonlyArray<readonly [RegExp, string]> = [
  [/200万辆悦享版/g, "юбилейная комплектация Enjoy"],
  [/40TFSI豪华动感型B&O星夜版/g, "40 TFSI Luxury Dynamic B&O Starry Night"],
  [/改款领先型M运动套装/g, "рестайлинг Leading, пакет M Sport"],
  // Составные правила идут раньше отдельных частей, чтобы в публичном
  // обозначении не оставались обрывки китайской комплектации.
  [/运动套装/g, "Sport"], [/改款/g, "рестайлинг"],
  [/时尚型/g, "Style"], [/悦尚型/g, "Comfort Style"],
  [/豪华型/g, "Luxury"], [/尊贵型/g, "Premium"], [/旗舰型/g, "Flagship"],
  // Модельные ряды, которые источник публикует иероглифами.
  [/途观/g, "Tiguan"], [/花冠/g, "Corolla"], [/朗逸/g, "Lavida"], [/揽胜星脉/g, "Range Rover Velar"],
  [/揽胜/g, "Range Rover"], [/轩逸/g, "Sylphy"], [/艾瑞泽/g, "Arrizo"],
  // Кузовные обозначения. Длинные варианты должны сработать до «轿跑».
  [/纯电动/g, "электро"], [/四门轿跑/g, "Gran Coupe"], [/敞篷/g, "Cabriolet"], [/轿跑/g, "купе"], [/掀背/g, "Hatchback"],
  [/加长版/g, "удлинённая"], [/超长续航版/g, "Long Range"],
  [/都会版/g, "Urban"], [/美规平行进口/g, "американская версия"],
  [/汽车/g, ""], [/二手/g, ""],
  [/领先型/g, "Leading"], [/尊享版/g, "Premium"],
  [/动感型运动版/g, "Dynamic Sport"], [/旗舰动感型/g, "Flagship Dynamic"],
  [/星耀臻藏版/g, "Star Premium"], [/劲势版/g, "Power"], [/思域/g, "Civic"],
  [/(\d{4})款/g, "$1"], [/([A-Z])级/gi, "$1-Class"], [/(\d+)系/g, "$1 Series "],
  [/自动/g, "АКПП"], [/手动/g, "МКПП"], [/前驱/g, "передний привод"], [/后驱/g, "задний привод"],
  [/四驱|全驱/g, "полный привод"], [/运动型|运动版/g, "Sport"], [/时尚版/g, "Style"],
  [/豪华版/g, "Luxury"], [/尊贵版/g, "Premium"], [/旗舰版/g, "Flagship"], [/标准版/g, "Standard"],
  [/舒适版/g, "Comfort"], [/卓越版/g, "Excellence"], [/臻享版/g, "Premium"],
  [/\(国Ⅵ\)|\(国VI\)/gi, "экостандарт China VI"], [/\(国Ⅴ\)|\(国V\)/gi, "экостандарт China V"],
  [/蓝标/g, "Blue Label"], [/红标/g, "Red Label"],
  [/第三代/g, "3-е поколение"], [/第二代/g, "2-е поколение"],
  [/豪华智联版/g, "Luxury Connect"], [/超豪华版|超豪版/g, "Super Luxury"],
  [/冠军版/g, "Champion"], [/智联版/g, "Connect"], [/互联版/g, "Connect"],
  [/精英版/g, "Elite"], [/进取版/g, "Progressive"], [/领先版/g, "Leading"],
  [/尊享版/g, "Premium"], [/尊贵型/g, "Premium"], [/豪华型/g, "Luxury"],
  [/舒适型/g, "Comfort"], [/标准型/g, "Standard"], [/都市版/g, "Urban"],
  [/两驱/g, "передний привод"], [/(\d+)座/g, "$1-местный"],
  [/plus/gi, "Plus"], [/pro/gi, "Pro"], [/max/gi, "Max"],
]

/** Deterministic, network-free preparation of an Iautos model title. */
export function localizeIautosModel(value: string) {
  return IAUTOS_MODEL_TERMS.reduce((model, [pattern, replacement]) => model.replace(pattern, replacement), value)
    .replace(/\s+/g, " ")
    .trim()
}
