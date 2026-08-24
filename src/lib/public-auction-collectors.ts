import type { AuctionImportItem } from "@/lib/auction-import"
import type { AuctionDamageKind, AuctionDamageReport } from "@/lib/auction-damage"
import {
  normalizeAuctionBodyType,
  normalizeAuctionDriveType,
  normalizeAuctionEngineVolumeCc,
  normalizeAuctionFuelType,
  normalizeAuctionMake,
  normalizeAuctionModel,
  normalizeAuctionTransmission,
  preferAuctionMakeMatch,
} from "@/lib/auction-normalization"
import { authorizedSourceGet } from "@/lib/authorized-source-http"
import { PublicListingPolicyExcludedError, isBobaedreamSoldListing, isCarsensorPriceOnRequest } from "@/lib/auction-source-policy"
import { extractIautosImages } from "@/lib/iautos-images"
import { localizeIautosModel } from "@/lib/iautos-model"
import { translateModelName } from "@/lib/nvidia-translate"
import { lookupVehiclePower } from "@/lib/vehicle-power-reference"
import {
  auctionSourceHtmlText as htmlText,
  auctionSourceTablePairs,
  decodeAuctionSourceHtml as decodeHtml,
} from "@/lib/auction-source-table.mjs"

export const PUBLIC_AUCTION_SOURCES = [
  "IAUTOS",
  "YOUXINPAI",
  "GOONET",
  "BEFORWARD",
  "CARSENSOR",
  "CARVAGO",
  "AUTOSALE",
  "BOBAEDREAM",
] as const
export type PublicAuctionSource = (typeof PUBLIC_AUCTION_SOURCES)[number]

export type PublicAuctionCandidate = {
  sourceId: string
  sourceUrl: string
  sourceTitle?: string | null
  sourcePrice?: number
  year?: number
  manufacturedMonth?: string | null
  registrationMonth?: string | null
  mileage?: number | null
  imageUrl?: string | null
  make?: string | null
  model?: string | null
  fuelType?: string | null
  transmission?: string | null
  bodyType?: string | null
  auctionDate?: Date | null
  referencePriceLow?: number | null
  referencePriceHigh?: number | null
  openingPrice?: number | null
  currentBid?: number | null
}

type UnknownRecord = Record<string, unknown>

const SOURCE_TIMEOUT_MS = 25_000
const SOURCE_MAX_BYTES = 4 * 1024 * 1024
const SOURCE_HEADERS = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.8",
  "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36",
}
const SOURCE_HOSTS: Record<PublicAuctionSource, ReadonlySet<string>> = {
  IAUTOS: new Set(["so.iautos.cn", "www.iautos.cn"]),
  YOUXINPAI: new Set(["api.youxinpai.cn", "www.youxinpai.cn"]),
  GOONET: new Set(["www.goo-net-exchange.com"]),
  BEFORWARD: new Set(["www.beforward.jp"]),
  CARSENSOR: new Set(["www.carsensor.net"]),
  CARVAGO: new Set(["carvago.com", "www.carvago.com"]),
  AUTOSALE: new Set(["autosale.ee"]),
  BOBAEDREAM: new Set(["www.bobaedream.co.kr"]),
}

const JAPANESE_MAKES: Readonly<Record<string, string>> = {
  "トヨタ": "Toyota", "ホンダ": "Honda", "日産": "Nissan", "ニッサン": "Nissan",
  "スズキ": "Suzuki", "ダイハツ": "Daihatsu", "三菱": "Mitsubishi", "マツダ": "Mazda",
  "スバル": "Subaru", "レクサス": "Lexus", "いすゞ": "Isuzu", "日野自動車": "Hino",
  "メルセデス・ベンツ": "Mercedes-Benz", "フォルクスワーゲン": "Volkswagen",
  "アウディ": "Audi", "ポルシェ": "Porsche", "ボルボ": "Volvo", "プジョー": "Peugeot",
  "ルノー": "Renault", "シトロエン": "Citroen", "フィアット": "Fiat", "ミニ": "MINI",
  "アバルト": "Abarth",
  "ランドローバー": "Land Rover", "ジャガー": "Jaguar", "ジープ": "Jeep",
  "シボレー": "Chevrolet", "フォード": "Ford", "ヒョンデ": "Hyundai", "起亜": "Kia",
}

const KATAKANA_ROMAJI: Readonly<Record<string, string>> = {
  ア: "a", イ: "i", ウ: "u", エ: "e", オ: "o", カ: "ka", キ: "ki", ク: "ku", ケ: "ke", コ: "ko",
  サ: "sa", シ: "shi", ス: "su", セ: "se", ソ: "so", タ: "ta", チ: "chi", ツ: "tsu", テ: "te", ト: "to",
  ナ: "na", ニ: "ni", ヌ: "nu", ネ: "ne", ノ: "no", ハ: "ha", ヒ: "hi", フ: "fu", ヘ: "he", ホ: "ho",
  マ: "ma", ミ: "mi", ム: "mu", メ: "me", モ: "mo", ヤ: "ya", ユ: "yu", ヨ: "yo", ラ: "ra", リ: "ri",
  ル: "ru", レ: "re", ロ: "ro", ワ: "wa", ヲ: "o", ン: "n", ガ: "ga", ギ: "gi", グ: "gu", ゲ: "ge",
  ゴ: "go", ザ: "za", ジ: "ji", ズ: "zu", ゼ: "ze", ゾ: "zo", ダ: "da", ヂ: "ji", ヅ: "zu", デ: "de",
  ド: "do", バ: "ba", ビ: "bi", ブ: "bu", ベ: "be", ボ: "bo", パ: "pa", ピ: "pi", プ: "pu", ペ: "pe",
  ポ: "po", ヴ: "vu", ァ: "a", ィ: "i", ゥ: "u", ェ: "e", ォ: "o", ャ: "ya", ュ: "yu", ョ: "yo",
  ー: "-",
}

const CHINESE_MAKES: ReadonlyArray<readonly [string, string]> = [
  // Совпадение ищется вхождением в заголовок карточки, поэтому список
  // отсортирован от длинных названий к коротким: иначе «长城» (Great Wall)
  // перехватил бы «长城哈弗» (Haval), а «奇瑞» — «奇瑞新能源».
  ["梅赛德斯-奔驰", "Mercedes-Benz"],
  ["玛莎拉蒂", "Maserati"], ["小米汽车", "Xiaomi"], ["小米", "Xiaomi"],
  ["阿尔法罗密欧", "Alfa Romeo"], ["劳斯莱斯", "Rolls-Royce"],
  ["英菲尼迪", "Infiniti"], ["捷豹", "Jaguar"], ["迷你", "MINI"],
  ["江铃", "JMC"], ["北京汽车", "BAIC"],
  // Народные модели Volkswagen источник пишет без марки, поэтому они
  // распознаются как самостоятельные ярлыки: иначе лот отбраковывался
  // с «не распознана марка».
  ["帕萨特", "Volkswagen"], ["速腾", "Volkswagen"], ["迈腾", "Volkswagen"],
  // Toyota и Chery источник тоже пишет одной моделью.
  ["陆地巡洋舰", "Toyota"], ["赛那", "Toyota"], ["花冠", "Toyota"],
  ["艾瑞泽", "Chery"],
  // Немецкие серии приходят без марки: «C级» вместо «奔驰C级». Классы
  // перечислены явно — список ярлыков ищет вхождение подстроки, шаблон здесь
  // работать не будет.
  ["A级", "Mercedes-Benz"], ["B级", "Mercedes-Benz"], ["C级", "Mercedes-Benz"],
  ["E级", "Mercedes-Benz"], ["S级", "Mercedes-Benz"], ["G级", "Mercedes-Benz"],
  ["1系", "BMW"], ["2系", "BMW"], ["3系", "BMW"], ["4系", "BMW"],
  ["5系", "BMW"], ["6系", "BMW"], ["7系", "BMW"], ["8系", "BMW"],
  ["朗逸", "Volkswagen"], ["桑塔纳", "Volkswagen"], ["探岭", "Volkswagen"],
 ["阿尔法·罗密欧", "Alfa Romeo"], ["一汽-大众", "Volkswagen"],
  ["奇瑞新能源", "Chery"], ["smart", "Smart"], ["雷克萨斯", "Lexus"],
  ["凯迪拉克", "Cadillac"], ["广汽传祺", "GAC"], ["上汽大众", "Volkswagen"],
  ["东风日产", "Nissan"], ["长安福特", "Ford"], ["北京现代", "Hyundai"],
  ["华晨宝马", "BMW"], ["长城哈弗", "Haval"], ["长安深蓝", "Deepal"],
  ["上汽大通", "Maxus"], ["东风风行", "Dongfeng"], ["北京汽车", "BAIC"],
  ["一汽奔腾", "Bestune"], ["特斯拉", "Tesla"], ["保时捷", "Porsche"],
  ["沃尔沃", "Volvo"], ["雪佛兰", "Chevrolet"], ["马自达", "Mazda"],
  ["斯柯达", "Skoda"], ["比亚迪", "BYD"], ["阿维塔", "Avatr"],
  ["奥迪", "Audi"], ["宝马", "BMW"], ["奔驰", "Mercedes-Benz"],
  ["大众", "Volkswagen"], ["丰田", "Toyota"], ["本田", "Honda"],
  ["日产", "Nissan"], ["路虎", "Land Rover"], ["别克", "Buick"],
  ["福特", "Ford"], ["现代", "Hyundai"], ["起亚", "Kia"],
  ["林肯", "Lincoln"], ["吉利", "Geely"], ["奇瑞", "Chery"],
  ["长城", "Great Wall"], ["红旗", "Hongqi"], ["理想", "Li Auto"],
  ["蔚来", "Nio"], ["小鹏", "Xpeng"], ["极氪", "Zeekr"],
  ["五菱", "Wuling"], ["荣威", "Roewe"], ["哈弗", "Haval"],
  ["哈佛", "Haval"], ["坦克", "Tank"], ["魏牌", "Wey"],
  ["欧拉", "Ora"], ["星途", "Exeed"], ["捷途", "Jetour"],
  ["长安", "Changan"], ["领克", "Lynk & Co"], ["名爵", "MG"],
  ["宝骏", "Baojun"], ["东风", "Dongfeng"], ["江淮", "JAC"],
  ["北汽", "BAIC"], ["极狐", "Arcfox"], ["岚图", "Voyah"],
  ["问界", "Aito"], ["腾势", "Denza"], ["零跑", "Leapmotor"],
  ["小米", "Xiaomi Auto"], ["海马", "Haima"],
]

const YOUXIN_DAMAGE_SECTION_LABELS: Readonly<Record<string, string>> = {
  exterior: "Кузов",
  "structural frame": "Силовой каркас",
  interior: "Салон",
  "water and fire damage inspection": "Следы воды и огня",
  "consumable parts": "Расходные элементы",
  "start-up inspection": "Запуск и работа агрегатов",
  "modification inspection": "Изменения конструкции",
  "electrical system inspection": "Электрика",
  "on-board tools": "Комплектность",
}

const YOUXIN_DAMAGE_PART_LABELS: Readonly<Record<string, string>> = {
  "front bumper": "Передний бампер",
  "rear bumper": "Задний бампер",
  "hood exterior": "Капот, наружная сторона",
  "left front door exterior": "Левая передняя дверь, наружная сторона",
  "right front door exterior": "Правая передняя дверь, наружная сторона",
  "left rear door exterior": "Левая задняя дверь, наружная сторона",
  "right rear door exterior": "Правая задняя дверь, наружная сторона",
  "left front door interior trim": "Обшивка левой передней двери",
  "right front door interior trim": "Обшивка правой передней двери",
  "right rear door interior trim": "Обшивка правой задней двери",
  "left front door rocker panel interior": "Внутренняя сторона порога левой передней двери",
  "right front door rocker panel interior": "Внутренняя сторона порога правой передней двери",
  "right front door rocker panel exterior": "Наружная сторона порога правой передней двери",
  "left rear door rocker panel interior": "Внутренняя сторона порога левой задней двери",
  "right rear door rocker panel interior": "Внутренняя сторона порога правой задней двери",
  "left rear fender outer side": "Левое заднее крыло, наружная сторона",
  "right rear fender outer side": "Правое заднее крыло, наружная сторона",
  "left c-pillar interior": "Левая задняя стойка, внутренняя сторона",
  "right c-pillar interior": "Правая задняя стойка, внутренняя сторона",
  "left c-pillar interior trim panel": "Обшивка левой задней стойки",
  "driver's instrument panel": "Панель приборов водителя",
  "front passenger instrument panel": "Передняя панель пассажира",
  "driver's seat area": "Зона сиденья водителя",
  "left rear seat area": "Зона левого заднего сиденья",
  "driver's seatbelt": "Ремень безопасности водителя",
  "left front carpet": "Ковровое покрытие слева спереди",
  "center armrest area": "Центральный подлокотник",
  "center console area": "Центральная консоль",
  "steering wheel": "Рулевое колесо",
  "trunk interior trim": "Обшивка багажника",
  "engine transmission and accessories": "Двигатель, трансмиссия и навесное оборудование",
}

const YOUXIN_DAMAGE_LABELS: Readonly<Record<string, string>> = {
  scratch: "Царапина",
  "scratches within 5cm": "Царапины до 5 см",
  "scratches 5-10cm": "Царапины 5–10 см",
  "dent within 5cm": "Вмятина до 5 см",
  "deformation 5-10cm": "Деформация 5–10 см",
  "damage within 3cm (inclusive)": "Повреждение до 3 см",
  "stains within 10cm (inclusive)": "Загрязнение до 10 см",
  "oil seepage": "Следы запотевания маслом",
  "paint surface abnormality": "Дефект лакокрасочного покрытия",
  replaced: "Элемент заменён",
  "standard repaint": "Обычная окраска",
  wear: "Следы износа",
  film: "Защитная или декоративная плёнка",
  "body repair and paint": "Кузовной ремонт и окраска",
}

const BOBAEDREAM_EQUIPMENT_LABELS: Readonly<Record<string, string>> = {
  "선루프": "Люк",
  "파노라마선루프": "Панорамная крыша",
  "알루미늄휠": "Легкосплавные диски",
  "전동사이드미러": "Электропривод зеркал",
  "HID램프": "Ксеноновые фары",
  "LED헤드램프": "Светодиодные фары",
  "어댑티드헤드램프": "Адаптивные фары",
  "LED리어램프": "Светодиодные задние фонари",
  "데이라이트": "Дневные ходовые огни",
  "하이빔어시스트": "Автоматический дальний свет",
  "압축도어": "Доводчики дверей",
  "자동슬라이딩도어": "Автоматические сдвижные двери",
  "전동사이드스탭": "Электрические подножки",
  "루프랙": "Рейлинги на крыше",
  "가죽시트": "Кожаный салон",
  "전동시트(운전석)": "Электропривод сиденья водителя",
  "전동시트(동승석)": "Электропривод сиденья пассажира",
  "열선시트(앞좌석)": "Подогрев передних сидений",
  "열선시트(뒷좌석)": "Подогрев задних сидений",
  "통풍시트": "Вентиляция сидений",
  "메모리시트": "Память настроек сидений",
  "폴딩시트": "Складные сиденья",
  "마사지시트": "Массаж сидений",
  "워크인시트": "Сиденье с облегчённым доступом",
  "요추받침": "Поясничная поддержка",
  "하이패스룸미러": "Зеркало с системой Hi-Pass",
  "ECM룸미러": "Зеркало с автозатемнением",
  "뒷좌석에어벤트": "Воздуховоды для задних пассажиров",
  "패들쉬프트": "Подрулевые переключатели",
  "전동햇빛가리개": "Электрические солнцезащитные шторки",
  "엠비언트라이트": "Контурная подсветка салона",
  "동승석에어백": "Подушка безопасности пассажира",
  "측면에어백": "Боковые подушки безопасности",
  "커튼에어백": "Шторки безопасности",
  "무릎에어백": "Коленная подушка безопасности",
  "승객감지에어백": "Система распознавания пассажира",
  "브레이크잠김방지(ABS)": "Антиблокировочная система",
  "차체자세제어장치(ESC)": "Система стабилизации",
  "후방센서": "Задние парктроники",
  "전방센서": "Передние парктроники",
  "후방카메라": "Камера заднего вида",
  "전방카메라": "Передняя камера",
  "어라운드뷰": "Круговой обзор",
  "타이어공기압감지(TPMS)": "Контроль давления в шинах",
  "차선이탈경보(LDWS)": "Контроль полосы движения",
  "자동긴급제동": "Автоматическое экстренное торможение",
  "전자제어서스펜션(ECS)": "Электронноуправляемая подвеска",
  "후측방경보": "Контроль слепых зон",
  "미끄럼방지(TCS)": "Противобуксовочная система",
  "스마트키": "Бесключевой доступ",
  "열선핸들": "Подогрев рулевого колеса",
  "리모컨핸들": "Управление мультимедиа на руле",
  "자동에어컨": "Климат-контроль",
  "좌우독립에어컨": "Раздельный климат-контроль",
  "오토라이트": "Автоматическое включение света",
  "크루즈컨트롤": "Круиз-контроль",
  "스마트크루즈컨트롤": "Адаптивный круиз-контроль",
  "스탑앤고": "Система старт-стоп",
  "전동트렁크": "Электропривод багажника",
  "스마트트렁크": "Бесконтактное открытие багажника",
  "전자주차브레이크(EPB)": "Электронный стояночный тормоз",
  "경사로밀림방지": "Помощь при старте на подъёме",
  "헤드업디스플레이(HUD)": "Проекционный дисплей",
  "무선충전": "Беспроводная зарядка",
  "자동주차": "Автоматическая парковка",
  "냉장고": "Холодильник",
  "네비게이션(순정)": "Штатная навигация",
  "네비게이션(비순정)": "Дополнительная навигация",
  "USB": "USB-разъёмы",
  "AUX": "Аудиовход AUX",
  "블루투스": "Bluetooth",
  "MP3": "Поддержка MP3",
  "DMB": "Цифровое телевидение",
  "CD플레이어": "CD-проигрыватель",
  "AV시스템": "Мультимедийная система",
  "뒷좌석TV": "Экраны для задних пассажиров",
  "텔레매틱스": "Телематическая система",
  "스마트폰미러링": "Интеграция со смартфоном",
}

const PUBLIC_EQUIPMENT_LABELS: Readonly<Record<string, string>> = {
  "power-folding exterior mirrors": "Складные наружные зеркала с электроприводом",
  "automatic climate control": "Климат-контроль",
  "rear independent climate control": "Отдельный климат-контроль для заднего ряда",
  "multimedia screen": "Мультимедийный экран",
  "360° surround-view camera system": "Система кругового обзора 360°",
  "driver's seat heating": "Подогрев сиденья водителя",
  "passenger seat heating": "Подогрев сиденья пассажира",
  "rear seat heating": "Подогрев задних сидений",
  "driver's seat ventilation": "Вентиляция сиденья водителя",
  "front passenger seat ventilation": "Вентиляция переднего пассажирского сиденья",
  "rear seat ventilation": "Вентиляция задних сидений",
  "driver's power seat": "Электропривод сиденья водителя",
  "front passenger power seat": "Электропривод переднего пассажирского сиденья",
  "driver's seat massage": "Массаж сиденья водителя",
  "co-driver seat massage": "Массаж переднего пассажирского сиденья",
  "rear seat massage": "Массаж задних сидений",
  "rear parking sensors": "Задние парктроники",
  "front parking sensors": "Передние парктроники",
  "power steering": "Усилитель рулевого управления",
  "head-up display (hud)": "Проекционный дисплей",
  "keyless start": "Бесключевой запуск двигателя",
  "electronic parking brake (epb)": "Электронный стояночный тормоз",
  "front door keyless entry": "Бесключевой доступ через передние двери",
  "multi-function steering wheel": "Многофункциональное рулевое колесо",
  "heated steering wheel": "Подогрев рулевого колеса",
  "steering wheel adjustment": "Регулировка рулевого колеса",
  "tire pressure monitoring": "Контроль давления в шинах",
  "drive type 4wd": "Полный привод",
  "cruise control": "Круиз-контроль",
  "backup camera": "Камера заднего вида",
  "panoramic sunroof": "Панорамная крыша",
  "manual air conditioning": "Кондиционер",
  "android auto": "Поддержка Android Auto",
  "armrest front": "Передний подлокотник",
  "assisted driving": "Системы помощи водителю",
  "bluetooth": "Поддержка Bluetooth",
  "led headlights": "Светодиодные фары",
  "induction charging for smartphones": "Беспроводная зарядка смартфона",
  "internet connection": "Подключение к интернету",
  "keyless entry": "Бесключевой доступ",
  "leather steering wheel": "Кожаное рулевое колесо",
  "multifunctional steering wheel": "Многофункциональное рулевое колесо",
  "navigation system": "Навигационная система",
  "power assisted steering": "Усилитель рулевого управления",
  "rain sensor": "Датчик дождя",
  "rear seats isofix points": "Крепления ISOFIX заднего ряда",
  "electrically heated side mirrors": "Обогрев наружных зеркал",
  "side mirrors with electric adjustment": "Электрорегулировка наружных зеркал",
  "touch screen": "Сенсорный экран",
  "traffic sign recognition": "Распознавание дорожных знаков",
  "usb": "USB-разъёмы",
}

const CARVAGO_COUNTRY_LABELS: Readonly<Record<string, string>> = {
  AT: "Австрия", BE: "Бельгия", BG: "Болгария", CH: "Швейцария", CZ: "Чехия",
  DE: "Германия", DK: "Дания", EE: "Эстония", ES: "Испания", FI: "Финляндия",
  FR: "Франция", HR: "Хорватия", HU: "Венгрия", IT: "Италия", LT: "Литва",
  LV: "Латвия", NL: "Нидерланды", PL: "Польша", PT: "Португалия", RO: "Румыния",
  SE: "Швеция", SI: "Словения", SK: "Словакия",
}

const CARVAGO_CITY_LABELS: Readonly<Record<string, string>> = {
  bragadiru: "Брагадиру",
}

// Пустая страница каталога — обычное состояние, а не поломка: площадка
// вернула заглушку или страница вышла за границу выдачи. Отдельный тип
// нужен, чтобы такой прогон не помечался как FAILED и не портил метрику
// надёжности источника.
export class EmptyCatalogPageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "EmptyCatalogPageError"
  }
}


export function isEmptyCatalogPageError(error: unknown): error is EmptyCatalogPageError {
  return error instanceof Error && error.name === "EmptyCatalogPageError"
}

export class PublicListingUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PublicListingUnavailableError"
  }
}

export function isPublicListingUnavailableError(error: unknown): error is PublicListingUnavailableError {
  return error instanceof PublicListingUnavailableError
}

export function isPublicAuctionSource(value: string): value is PublicAuctionSource {
  return PUBLIC_AUCTION_SOURCES.includes(value as PublicAuctionSource)
}

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : null
}

function asText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function asNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function modelYearFromText(...values: Array<string | null | undefined>) {
  const currentYear = new Date().getFullYear()
  for (const value of values) {
    const year = Number(value?.match(/\b(19\d{2}|20\d{2})\b/)?.[1])
    if (Number.isInteger(year) && year >= 1886 && year <= currentYear + 1) return year
  }
  return null
}

function bobaedreamWon(value: string | null | undefined) {
  const tenThousands = asNumber(value?.match(/([\d,]+)\s*만원/)?.[1]?.replace(/,/g, ""))
  return tenThousands === null ? null : Math.round(tenThousands * 10_000)
}

function bobaedreamEquipment(html: string) {
  const items = [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].flatMap((match) => {
    const block = match[1]
    if (!/\bchecked\b/i.test(block)) return []
    const rawLabel = htmlText(firstMatch(block, /<button[^>]*>([\s\S]*?)<\/button>/i))
    const label = rawLabel ? BOBAEDREAM_EQUIPMENT_LABELS[rawLabel] : null
    return label ? [{ label, available: true }] : []
  })
  const uniqueItems = [...new Map(items.map((item) => [item.label, item])).values()]
  return uniqueItems.length ? { totalReported: uniqueItems.length, items: uniqueItems.slice(0, 60) } : null
}

function publicEquipment(labels: Array<string | null>) {
  const reported = labels.filter((label): label is string => Boolean(label))
  const items = reported.flatMap((label) => {
    const translated = PUBLIC_EQUIPMENT_LABELS[label.normalize("NFKC").trim().toLocaleLowerCase("en-US")]
    return translated ? [{ label: translated, available: true }] : []
  })
  const uniqueItems = [...new Map(items.map((item) => [item.label, item])).values()]
  return uniqueItems.length ? { totalReported: reported.length, items: uniqueItems.slice(0, 60) } : null
}

function firstMatch(value: string, pattern: RegExp) {
  return value.match(pattern)?.[1]?.trim() || null
}

function safeImage(value: string | null, allowedHosts: ReadonlySet<string>) {
  if (!value) return null
  try {
    const decoded = decodeHtml(value)
    const url = new URL(decoded.startsWith("//") ? `https:${decoded}` : decoded)
    return url.protocol === "https:" && allowedHosts.has(url.hostname) ? url.toString() : null
  } catch {
    return null
  }
}

function sourceRussianText(value: string | null) {
  return value && /[\u0400-\u04FF]/.test(value) && !/[\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/.test(value) ? value : null
}

function uniqueDamagePhrases(values: string | string[]) {
  const source = Array.isArray(values) ? values : [values]
  const unique = new Map<string, string>()
  for (const phrase of source.flatMap((value) => value.split(/\s*[;|、]+\s*/)).map((value) => value.trim()).filter(Boolean)) {
    const key = phrase.normalize("NFKC").toLocaleLowerCase("ru-RU")
    if (!unique.has(key)) unique.set(key, phrase)
  }
  return [...unique.values()].join("; ")
}

function localizeYouxinDamageSection(value: string | null) {
  const nativeRussian = sourceRussianText(value)
  if (nativeRussian) return nativeRussian
  return value ? YOUXIN_DAMAGE_SECTION_LABELS[value.normalize("NFKC").trim().toLocaleLowerCase("en-US")] || "Дополнительная проверка" : "Дополнительная проверка"
}

function localizeYouxinDamagePart(value: string | null) {
  const nativeRussian = sourceRussianText(value)
  if (nativeRussian) return nativeRussian
  if (!value) return "Деталь автомобиля"
  const normalized = value.normalize("NFKC").trim().toLocaleLowerCase("en-US")
  const exact = YOUXIN_DAMAGE_PART_LABELS[normalized]
  if (exact) return exact

  const translated = normalized
    .replace(/driver's/g, "водителя")
    .replace(/front passenger/g, "переднего пассажира")
    .replace(/left/g, "левая")
    .replace(/right/g, "правая")
    .replace(/front/g, "передняя")
    .replace(/rear/g, "задняя")
    .replace(/rocker panel/g, "порог")
    .replace(/trim panel|interior trim/g, "обшивка")
    .replace(/fender/g, "крыло")
    .replace(/[a-d]-pillar/g, "стойка кузова")
    .replace(/door/g, "дверь")
    .replace(/bumper/g, "бампер")
    .replace(/hood/g, "капот")
    .replace(/seatbelt/g, "ремень безопасности")
    .replace(/seat/g, "сиденье")
    .replace(/instrument panel/g, "панель приборов")
    .replace(/steering wheel/g, "рулевое колесо")
    .replace(/center console/g, "центральная консоль")
    .replace(/center armrest/g, "центральный подлокотник")
    .replace(/trunk/g, "багажник")
    .replace(/carpet/g, "ковровое покрытие")
    .replace(/outer side|exterior/g, "наружная сторона")
    .replace(/interior/g, "внутренняя сторона")
    .replace(/area/g, "зона")
    .replace(/\s+/g, " ")
    .trim()
  return /[a-z]/i.test(translated) ? "Деталь автомобиля по отчёту" : `${translated[0]?.toLocaleUpperCase("ru-RU") || ""}${translated.slice(1)}`
}

function localizeYouxinDamageNote(value: string | null) {
  const nativeRussian = sourceRussianText(value)
  if (nativeRussian) return uniqueDamagePhrases(nativeRussian)
  if (!value) return "Замечание осмотра"
  const entries = value.split(/[|、]+/).map((entry) => entry.normalize("NFKC").trim()).filter(Boolean)
  const translated = entries.flatMap((entry) => {
    const normalized = entry.toLocaleLowerCase("en-US")
    const exact = YOUXIN_DAMAGE_LABELS[normalized]
    if (exact) return [exact]
    const scratchWithin = normalized.match(/^scratches? within (\d+)cm(?: \(inclusive\))?$/)
    if (scratchWithin) return [`Царапины до ${scratchWithin[1]} см`]
    const scratchRange = normalized.match(/^scratches? (\d+)-(\d+)cm$/)
    if (scratchRange) return [`Царапины ${scratchRange[1]}–${scratchRange[2]} см`]
    const dentWithin = normalized.match(/^dent within (\d+)cm$/)
    if (dentWithin) return [`Вмятина до ${dentWithin[1]} см`]
    const deformationRange = normalized.match(/^deformation (\d+)-(\d+)cm$/)
    if (deformationRange) return [`Деформация ${deformationRange[1]}–${deformationRange[2]} см`]
    return ["Замечание осмотра"]
  })
  return uniqueDamagePhrases(translated) || "Замечание осмотра"
}

function youxinDamageKinds(values: Array<string | null>, seriousCount: number, level: number): AuctionDamageKind[] {
  const kinds = new Set<AuctionDamageKind>([seriousCount > 0 || level >= 2 ? "SERIOUS" : "COMMON"])
  const source = values.filter((value): value is string => Boolean(value)).join(" ").toLocaleLowerCase("en-US")
  if (/body repair|repair and paint|sheet metal/.test(source)) kinds.add("BODY_REPAIR_PAINT")
  if (/repaint|standard paint/.test(source)) kinds.add("REPAINT")
  if (/\bfilm\b|\bwrap(?:ped)?\b/.test(source)) kinds.add("FILM")
  if (/replaced|replacement/.test(source)) kinds.add("REPLACED")
  return [...kinds]
}

function youxinDamagePoint(value: string | null) {
  if (!value) return { x: null, y: null }
  const [x, y] = value.split(",").map(Number)
  return Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 1 && y >= 0 && y <= 1
    ? { x, y }
    : { x: null, y: null }
}

function youxinDamageReport(detailInfo: UnknownRecord | null): AuctionDamageReport | null {
  const groups = Array.isArray(detailInfo?.defects) ? detailInfo.defects : []
  const grades = asRecord(detailInfo?.grades)
  const diagramByCode: Readonly<Record<string, string | null>> = {
    "1": safeImage(asText(grades?.facadeImage), new Set(["img.youxinpai.cn"])),
    "2": safeImage(asText(grades?.skeletonImage), new Set(["img.youxinpai.cn"])),
    "3": safeImage(asText(grades?.interiorImage), new Set(["img.youxinpai.cn"])),
  }

  let totalItems = 0
  const sections = groups.flatMap((groupValue, sectionIndex) => {
    const group = asRecord(groupValue)
    if (!group || totalItems >= 80) return []
    const code = String(Math.round(asNumber(group.moduleCode) || sectionIndex + 1))
    const abnormalItems = Array.isArray(group.abnormalDefectItems) ? group.abnormalDefectItems : []
    const items = abnormalItems.flatMap((itemValue, itemIndex) => {
      const item = asRecord(itemValue)
      if (!item || totalItems >= 80) return []
      const detectItems = Array.isArray(item.detectItems) ? item.detectItems : []
      const rawNotes = [asText(item.desc), ...detectItems.map((entry) => asText(asRecord(entry)?.name))]
      const seriousCount = Math.round(asNumber(item.seriousFlawCount) || 0)
      const level = Math.round(asNumber(item.level) || 0)
      const itemKinds = youxinDamageKinds(rawNotes, seriousCount, level)
      const note = uniqueDamagePhrases(rawNotes.flatMap((value) => value ? [localizeYouxinDamageNote(value)] : [])) || "Замечание осмотра"
      const fallbackPoint = asText(asRecord(detectItems[0])?.positionMap)
      const point = youxinDamagePoint(asText(item.ratioLocation) || fallbackPoint)
      const photos = detectItems.flatMap((photoValue) => {
        const photo = asRecord(photoValue)
        const url = safeImage(asText(photo?.originPic), new Set(["img.youxinpai.cn"]))
        if (!photo || !url) return []
        const photoRawNote = asText(photo.name) || asText(item.desc)
        const photoLevel = Math.round(asNumber(photo.level) || level)
        return [{
          url,
          note: localizeYouxinDamageNote(photoRawNote),
          kinds: youxinDamageKinds([photoRawNote], seriousCount, photoLevel),
        }]
      }).slice(0, 8)

      totalItems += 1
      return [{
        id: `${code}-${asText(item.key) || itemIndex + 1}`,
        part: localizeYouxinDamagePart(asText(item.name)),
        note,
        kinds: itemKinds,
        ...point,
        photos,
      }]
    })

    return items.length > 0 ? [{
      code,
      label: localizeYouxinDamageSection(asText(group.moduleName)),
      diagramUrl: diagramByCode[code] || null,
      items,
    }] : []
  })

  return sections.length > 0 ? { sourceLabel: "Открытый отчёт осмотра YouXinPai", sections } : null
}

function titleCaseSlug(value: string) {
  return value.split("-").filter(Boolean).map((part) => part ? `${part[0].toUpperCase()}${part.slice(1).toLowerCase()}` : "").join(" ")
}

function romanizeJapanese(value: string) {
  const normalized = value.normalize("NFKC")
    .replace(/\u30b7\u30ea\u30fc\u30ba/g, " Series")
    .replace(/\u30cf\u30a4\u30d6\u30ea\u30c3\u30c9/g, " Hybrid")
    .replace(/\u30ab\u30b9\u30bf\u30e0/g, " Custom")
    .replace(/\u30c4\u30fc\u30ea\u30f3\u30b0/g, " Touring")
    .replace(/\u30b9\u30dd\u30fc\u30c4/g, " Sport")
    .replace(/\u30bf\u30fc\u30dc/g, " Turbo")
    .replace(/\u30a8\u30c7\u30a3\u30b7\u30e7\u30f3/g, " Edition")
    .replace(/\u30d1\u30c3\u30b1\u30fc\u30b8/g, " Package")
  let result = ""
  let doubleNext = false
  for (const character of normalized) {
    if (character === "ッ") {
      doubleNext = true
      continue
    }
    const syllable = KATAKANA_ROMAJI[character]
    if (!syllable) {
      result += character
      doubleNext = false
      continue
    }
    result += doubleNext && /^[a-z]/.test(syllable) ? `${syllable[0]}${syllable}` : syllable
    doubleNext = false
  }
  return result.replace(/([aeiou])-+/g, "$1").replace(/[\u3040-\u30FF\u3400-\u9FFF]+/g, " ").replace(/\s+/g, " ").trim()
}

function jsonLdObjects(html: string) {
  const objects: UnknownRecord[] = []
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(match[1]) as unknown
      const values = Array.isArray(parsed) ? parsed : [parsed]
      for (const value of values) {
        const record = asRecord(value)
        if (record) objects.push(record)
      }
    } catch {
      // Some providers publish almost-JSON with trailing commas. Their stable
      // fields are parsed from the HTML below instead of trusting broken data.
    }
  }
  return objects
}

async function sourceHtml(source: PublicAuctionSource, url: string) {
  const rangeHeaders = source === "BEFORWARD" && /\/detail\d+\.xml$/i.test(url)
    ? { ...SOURCE_HEADERS, Range: "bytes=0-999999" }
    : SOURCE_HEADERS
  const response = await authorizedSourceGet(url, {
    allowedHosts: SOURCE_HOSTS[source], headers: rangeHeaders,
    timeoutMs: source === "BOBAEDREAM" ? 45_000 : SOURCE_TIMEOUT_MS, maxBytes: SOURCE_MAX_BYTES,
  })
  if (response.status === 404 || response.status === 410) throw new PublicListingUnavailableError(`Карточка ${source} снята с публикации`)
  if (!response.ok) throw new Error(`${source} вернул HTTP ${response.status}`)
  return response.text()
}

export function publicSourceCatalogUrl(source: PublicAuctionSource, page: number) {
  if (source === "IAUTOS") return page <= 1 ? "https://so.iautos.cn/quanguo/" : `https://so.iautos.cn/quanguo/p${page}asdsvepcatcpbnscac/#buyCars`
  if (source === "YOUXINPAI") return `https://api.youxinpai.cn/api/auction/list?pageNum=${page}&pageSize=20&auctionType=1`
  if (source === "GOONET") return "https://www.goo-net-exchange.com/php/search/summary.php?year_min=2021&search_type=year_search"
  if (source === "BEFORWARD") return `https://www.beforward.jp/detail${String(page).padStart(3, "0")}.xml`
  if (source === "CARSENSOR") return `https://www.carsensor.net/usedcar-detail-${page % 10 + 1}.xml`
  if (source === "AUTOSALE") return "https://autosale.ee/sitemap.php"
  if (source === "BOBAEDREAM") return `https://www.bobaedream.co.kr/mycar/mycar_list.php?gubun=K&page=${page}`
  return "https://carvago.com/sitemap-listed-cars.xml"
}

export function publicSourceMaximumPage(source: PublicAuctionSource) {
  if (source === "IAUTOS" || source === "BOBAEDREAM") return 50
  if (source === "GOONET" || source === "BEFORWARD") return 20
  if (source === "CARSENSOR") return 10
  if (source === "YOUXINPAI") return 50
  if (source === "AUTOSALE") return 1
  return 200
}

function parseIautosCatalog(html: string): PublicAuctionCandidate[] {
  const candidates: PublicAuctionCandidate[] = []
  for (const match of html.matchAll(/<li\s+data-id="(\d+)"[^>]*>([\s\S]*?)<\/li>/gi)) {
    const sourceId = match[1]
    const block = match[2]
    const sourceUrl = firstMatch(block, /href="(https:\/\/www\.iautos\.cn\/usedcar-\d+\.html)"/i)
    const date = firstMatch(block, /<div class="parameter">[\s\S]*?<span>\s*(\d{4})年(\d{2})月\s*<\/span>/i)
    const month = block.match(/<div class="parameter">[\s\S]*?<span>\s*\d{4}年(\d{2})月\s*<\/span>/i)?.[1]
    const mileageWan = asNumber(firstMatch(block, /<div class="parameter">[\s\S]*?<span>\s*([\d.]+)万公里/i))
    const priceWan = asNumber(firstMatch(block, /<strong class="num">\s*([\d.]+)\s*<\/strong>/i))
    const imageUrl = extractIautosImages(block)[0] || null
    if (!sourceUrl || !date || !month || mileageWan === null || priceWan === null || priceWan <= 0) continue
    candidates.push({
      sourceId, sourceUrl, sourcePrice: Math.round(priceWan * 10_000), year: Number(date),
      manufacturedMonth: `${date}-${month}`, mileage: Math.round(mileageWan * 10_000), imageUrl,
    })
  }
  return candidates
}

function parseGoonetCatalog(html: string): PublicAuctionCandidate[] {
  const candidates: PublicAuctionCandidate[] = []
  for (const match of html.matchAll(/<a\s+class="spread_link_new_tab"\s+href="(\/usedcars\/[^\"]+\/(\d+)\/)"/gi)) {
    candidates.push({ sourceId: match[2], sourceUrl: `https://www.goo-net-exchange.com${match[1]}` })
  }
  return candidates
}

function parseCarvagoSitemap(xml: string): PublicAuctionCandidate[] {
  const candidates: PublicAuctionCandidate[] = []
  for (const match of xml.matchAll(/<loc>https?:\/\/carvago\.com\/car\/(\d+)\/([^<]+)<\/loc>/gi)) {
    candidates.push({ sourceId: match[1], sourceUrl: `https://carvago.com/car/${match[1]}/${decodeHtml(match[2])}` })
  }
  return candidates
}

function uniqueCandidates(candidates: PublicAuctionCandidate[]) {
  return [...new Map(candidates.map((candidate) => [candidate.sourceId, candidate])).values()]
}

function parseBobaedreamCatalog(html: string) {
  const candidates: PublicAuctionCandidate[] = []
  for (const match of html.matchAll(/(?:href=["'])?(?:https:\/\/www\.bobaedream\.co\.kr)?\/mycar\/mycar_view\.php\?no=(\d+)(?:&amp;|&)gubun=K/gi)) {
    candidates.push({
      sourceId: match[1],
      sourceUrl: `https://www.bobaedream.co.kr/mycar/mycar_view.php?no=${match[1]}&gubun=K`,
    })
  }
  return uniqueCandidates(candidates)
}

function parseBeforwardSitemap(xml: string) {
  const candidates: PublicAuctionCandidate[] = []
  for (const match of xml.matchAll(/<loc>(https:\/\/www\.beforward\.jp\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+\/id\/(\d+)\/)<\/loc>/gi)) {
    candidates.push({ sourceId: match[2], sourceUrl: decodeHtml(match[1]) })
  }
  return uniqueCandidates(candidates)
}

function parseCarsensorSitemap(xml: string) {
  const candidates: PublicAuctionCandidate[] = []
  for (const match of xml.matchAll(/<loc>(https:\/\/www\.carsensor\.net\/usedcar\/detail\/(AU\d+)\/index\.html)<\/loc>/gi)) {
    candidates.push({ sourceId: match[2], sourceUrl: match[1] })
  }
  return uniqueCandidates(candidates)
}

function parseAutosaleSitemap(xml: string) {
  const candidates: PublicAuctionCandidate[] = []
  for (const match of xml.matchAll(/<loc>(https:\/\/autosale\.ee\/listings\/view\.php\?id=(\d+))<\/loc>/gi)) {
    candidates.push({ sourceId: match[2], sourceUrl: decodeHtml(match[1]) })
  }
  return uniqueCandidates(candidates)
}

const youxinpaiCatalogCache = new Map<number, { expiresAt: number; candidates: PublicAuctionCandidate[] }>()
const youxinpaiCatalogPending = new Map<number, Promise<PublicAuctionCandidate[]>>()
const YOUXINPAI_CATALOG_SCAN_CONCURRENCY = 4

function parseYouxinpaiCatalog(json: string, pageNumber: number) {
  let root: UnknownRecord
  try { root = JSON.parse(json) as UnknownRecord } catch { throw new Error("YOUXINPAI: повреждены данные каталога") }
  const page = asRecord(asRecord(root.data)?.page)
  const records = Array.isArray(page?.records) ? page.records : []
  const candidates: PublicAuctionCandidate[] = []
  for (const value of records) {
    const record = asRecord(value)
    const sourceId = asNumber(record?.publishId)
    const openingPrice = asNumber(record?.startPrice)
    const currentBid = asNumber(record?.currentHighestBid)
    const referencePriceLow = asNumber(record?.refPriceLow)
    const referencePriceHigh = asNumber(record?.refPriceHigh)
    // The opening bid is not the expected purchase price. For the preliminary
    // landed-cost estimate use the highest public price signal and keep the
    // complete source range for an explicit explanation in the listing.
    const price = Math.max(openingPrice || 0, currentBid || 0, referencePriceLow || 0, referencePriceHigh || 0)
    const registered = asText(record?.registerDate)?.match(/^(\d{4})-(\d{2})-/)
    const make = normalizeAuctionMake(asText(record?.brandName))
    const serialName = asText(record?.serialName) || ""
    const modelName = asText(record?.modelName) || ""
    const serialWithoutMake = make && serialName.toLocaleLowerCase().startsWith(`${make.toLocaleLowerCase()} `)
      ? serialName.slice(make.length).trim()
      : serialName
    const model = normalizeAuctionModel([serialWithoutMake, modelName && modelName !== serialName ? modelName : null].filter(Boolean).join(" "))
    const modelYear = modelYearFromText(modelName, serialName) || Number(registered?.[1])
    // The catalogue thumbnail is a valid signed/public rendition. Rewriting
    // `/small/` to the guessed original path makes YouXinPai answer with 403.
    const image = asText(record?.mainImage)
    if (!sourceId || !price || !registered || !make || !model || asNumber(record?.auctionStatus) !== 1) continue
    const bodyCode = asNumber(record?.bodyType)
    const fuelCode = asNumber(record?.fuelType)
    candidates.push({
      sourceId: String(sourceId), sourceUrl: `https://www.youxinpai.cn/auction/detail?publishId=${sourceId}`,
      sourceTitle: [serialName, modelName].filter(Boolean).join(" "),
      sourcePrice: Math.round(price), year: modelYear, manufacturedMonth: null, registrationMonth: `${registered[1]}-${registered[2]}`,
      mileage: asNumber(record?.mileage), imageUrl: safeImage(image, new Set(["img.youxinpai.cn"])), make, model,
      fuelType: fuelCode === 1 ? "DIESEL" : fuelCode === 2 ? "HYBRID" : fuelCode === 3 ? "ELECTRIC" : "GASOLINE",
      transmission: asNumber(record?.gearbox) === 1 ? "AUTOMATIC" : null,
      bodyType: bodyCode === 1 ? "SEDAN" : bodyCode === 3 ? "SUV" : null,
      auctionDate: (() => {
        const timestamp = asNumber(record?.priceStopTime)
        return timestamp ? new Date(timestamp) : null
      })(),
      referencePriceLow,
      referencePriceHigh,
      openingPrice,
      currentBid,
    })
  }
  const unique = uniqueCandidates(candidates)
  youxinpaiCatalogCache.set(pageNumber, { expiresAt: Date.now() + 2 * 60_000, candidates: unique })
  return unique
}

async function youxinpaiCatalogPage(page: number) {
  const cached = youxinpaiCatalogCache.get(page)
  if (cached && cached.expiresAt > Date.now()) return cached.candidates

  const pending = youxinpaiCatalogPending.get(page)
  if (pending) return pending

  const request = sourceHtml("YOUXINPAI", publicSourceCatalogUrl("YOUXINPAI", page))
    .then((json) => parseYouxinpaiCatalog(json, page))
    .finally(() => youxinpaiCatalogPending.delete(page))
  youxinpaiCatalogPending.set(page, request)
  return request
}

export async function discoverPublicAuctionCandidates(source: PublicAuctionSource, page: number, limit: number) {
  const html = await sourceHtml(source, publicSourceCatalogUrl(source, page))
  const all = source === "IAUTOS" ? parseIautosCatalog(html)
    : source === "YOUXINPAI" ? parseYouxinpaiCatalog(html, page)
      : source === "GOONET" ? parseGoonetCatalog(html)
        : source === "BEFORWARD" ? parseBeforwardSitemap(html)
          : source === "CARSENSOR" ? parseCarsensorSitemap(html)
            : source === "AUTOSALE" ? parseAutosaleSitemap(html)
              : source === "BOBAEDREAM" ? parseBobaedreamCatalog(html)
                : parseCarvagoSitemap(html)
  if (!all.length) throw new EmptyCatalogPageError(`${source}: страница ${page} каталога пуста`)
  if (source === "IAUTOS" || source === "YOUXINPAI" || source === "BOBAEDREAM") return { total: all.length, candidates: all.slice(0, limit) }
  const start = ((page - 1) * limit) % all.length
  return { total: all.length, candidates: [...all.slice(start), ...all.slice(0, start)].slice(0, limit) }
}

function overviewPairs(html: string) {
  const result = new Map<string, string>()
  for (const match of html.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi)) {
    const key = htmlText(match[1])
    const value = htmlText(match[2])
    if (key && value) result.set(key, value)
  }
  return result
}

function tablePairs(html: string) {
  return auctionSourceTablePairs(html) as Map<string, string>
}

function sourcePowerHorsepower(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.round(value)
  if (typeof value !== "string") return null
  const normalized = value.normalize("NFKC").replace(/,/g, ".")
  const horsepower = normalized.match(/([\d.]+)\s*(?:л\.?\s*с\.?|hp|ps|bhp|馬力|马力)/i)
  if (horsepower) return Math.round(Number(horsepower[1])) || null
  const kilowatts = normalized.match(/([\d.]+)\s*kW/i)
  return kilowatts ? Math.round(Number(kilowatts[1]) * 1.35962) || null : null
}

function diagnosticSourceLabel(value: string) {
  return value.normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100)
}

async function fetchIautosListing(candidate: PublicAuctionCandidate): Promise<AuctionImportItem> {
  if (!/^\d+$/.test(candidate.sourceId) || !/^https:\/\/www\.iautos\.cn\/usedcar-\d+\.html$/.test(candidate.sourceUrl)) throw new Error("Некорректная карточка Iautos")
  if (!candidate.sourcePrice || !candidate.year) throw new Error(`Iautos: нет каталожной цены карточки ${candidate.sourceId}`)
  const html = await sourceHtml("IAUTOS", candidate.sourceUrl)
  if (!html.includes(`usedcar-${candidate.sourceId}`) && !html.includes(`车源编号：<i>${candidate.sourceId}</i>`)) throw new PublicListingUnavailableError(`Iautos: карточка ${candidate.sourceId} отсутствует`)
  const title = htmlText(firstMatch(html, /<h1 class="title[^\"]*"[^>]*><span>([\s\S]*?)<\/span><\/h1>/i))
  if (!title) throw new Error(`Iautos: у карточки ${candidate.sourceId} нет названия`)
  const makeEntry = preferAuctionMakeMatch(title, CHINESE_MAKES)
  if (!makeEntry) throw new Error(`Iautos: не распознана марка «${diagnosticSourceLabel(title)}» карточки ${candidate.sourceId}`)
  // Источник иногда дублирует марку в начале строки («哈弗哈弗H6»), и снятие
  // одного вхождения оставляло иероглифы в модели — лот отбраковывался.
  let modelOriginal = title
  while (modelOriginal.startsWith(makeEntry[0])) {
    modelOriginal = modelOriginal.slice(makeEntry[0].length).trim()
  }
  modelOriginal = modelOriginal.replace(makeEntry[0], "").trim()
  const pairs = tablePairs(html)
  const engineText = pairs.get("发动机") || firstMatch(title, /(\d+(?:\.\d+)?L)/i)
  const power = sourcePowerHorsepower(pairs.get("发动机功率") || pairs.get("最大功率") || engineText)
  const fuelType = normalizeAuctionFuelType(pairs.get("燃料类型") || pairs.get("能源类型"))

  const deterministicModel = normalizeAuctionModel(localizeIautosModel(modelOriginal))
  const model = deterministicModel || normalizeAuctionModel(await translateModelName(modelOriginal))
  if (!model) throw new Error(`Iautos: не переведена модель «${diagnosticSourceLabel(modelOriginal)}» карточки ${candidate.sourceId}`)

  const images = extractIautosImages(html)
  if (!images.length && candidate.imageUrl) images.push(candidate.imageUrl)
  const sourceDescription = htmlText(firstMatch(html, /<p class="see-one-part"[^>]*>([\s\S]*?)<\/p>/i))
  const displacement = asNumber(engineText?.match(/([\d.]+)L/i)?.[1])
  const transmission = normalizeAuctionTransmission(pairs.get("变速箱"))
  const bodyType = normalizeAuctionBodyType(pairs.get("车身结构") || pairs.get("车辆级别"))
  const driveType = normalizeAuctionDriveType(pairs.get("驱动方式"))
  const location = htmlText(firstMatch(html, /<h6 class="t">所在地<\/h6>\s*<p class="d[^\"]*">([\s\S]*?)<\/p>/i))
  const seats = asNumber(pairs.get("座位数")?.replace(/[^\d]/g, ""))
  const doors = asNumber(pairs.get("车门数")?.replace(/[^\d]/g, ""))
  const specs = [
    `Год выпуска: ${candidate.year}`,
    candidate.manufacturedMonth ? `Месяц выпуска: ${candidate.manufacturedMonth}` : null,
    `Пробег: ${(candidate.mileage ?? 0).toLocaleString("ru-RU")} км`,
    `Номер лота: ${candidate.sourceId}`,
    displacement ? `Объём двигателя: ${Math.round(displacement * 1_000).toLocaleString("ru-RU")} см³` : null,
    power ? `Мощность: ${power} л.с.` : null,
    fuelType ? `Топливо: ${fuelType}` : null,
    transmission ? `КПП: ${transmission}` : null,
    bodyType ? `Кузов: ${bodyType}` : null,
    driveType ? `Привод: ${driveType}` : null,
    seats ? `Количество мест: ${Math.round(seats)}` : null,
    doors ? `Количество дверей: ${Math.round(doors)}` : null,
    pairs.get("排放标准") ? `Экологический стандарт: ${pairs.get("排放标准")}` : null,
    pairs.get("颜色") ? `Цвет: ${pairs.get("颜色")}` : null,
    location ? `Местонахождение: ${location}` : null,
  ].filter((value): value is string => Boolean(value))
  return {
    source: "IAUTOS", sourceId: candidate.sourceId, sourceUrl: candidate.sourceUrl,
    sourceTitle: title,
    make: makeEntry[1], model, year: candidate.year, manufacturedMonth: candidate.manufacturedMonth || null,
    sourcePrice: candidate.sourcePrice, sourceCurrency: "CNY", country: "CN", auctionDate: null,
    mileage: candidate.mileage ?? null, fuelType,
    transmission, bodyType,
    color: pairs.get("颜色") || null, engineVolume: displacement, power: power ? Math.round(power) : null,
    driveType, vin: null, lotNumber: candidate.sourceId,
    imageUrl: images[0] || null, images,
    descriptionOrig: `${makeEntry[1]} ${model}. Автомобиль из открытого каталога Iautos.${sourceDescription ? " В исходной карточке опубликовано описание продавца; перед сделкой сверьте его с источником." : ""}`,
    specsOrig: specs.join("; "),
    location,
  }
}

async function fetchGoonetListing(candidate: PublicAuctionCandidate): Promise<AuctionImportItem> {
  if (!/^\d+$/.test(candidate.sourceId) || !candidate.sourceUrl.startsWith("https://www.goo-net-exchange.com/usedcars/")) throw new Error("Некорректная карточка Goo-net")
  const html = await sourceHtml("GOONET", candidate.sourceUrl)
  const jsonText = firstMatch(html, /<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/i)
  if (!jsonText) throw new PublicListingUnavailableError(`Goo-net: карточка ${candidate.sourceId} отсутствует`)
  let product: UnknownRecord
  try { product = JSON.parse(jsonText) as UnknownRecord } catch { throw new Error(`Goo-net: повреждены данные карточки ${candidate.sourceId}`) }
  const brand = asText(asRecord(product.brand)?.name)
  const title = asText(product.name)
  const offers = asRecord(product.offers)
  const sourcePrice = asNumber(offers?.price)
  const overview = overviewPairs(html)
  const date = overview.get("Month/Year")?.match(/(0[1-9]|1[0-2])\.(\d{4})/)
  const make = normalizeAuctionMake(brand)
  const model = normalizeAuctionModel(title && brand ? title.replace(new RegExp(`^${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`, "i"), "") : title)
  if (!make || !model || !sourcePrice || !date) throw new Error(`Goo-net: неполная карточка ${candidate.sourceId}`)
  const images = [...new Set([...html.matchAll(/https:\/\/picture1\.goo-net\.com\/[^\s"')]+\.(?:jpg|jpeg|png)/gi)]
    .map((match) => safeImage(match[0], new Set(["picture1.goo-net.com"]))).filter((url): url is string => Boolean(url)))].slice(0, 60)
  const fuelType = normalizeAuctionFuelType(overview.get("Fuel"))
  const transmission = normalizeAuctionTransmission(overview.get("Transmission"))
  const bodyType = normalizeAuctionBodyType(asText(product.bodyType) || asText(product.category) || overview.get("Body Type"))
  const driveType = normalizeAuctionDriveType(overview.get("Drive System"))
  const engineVolume = asNumber(overview.get("Displacement")?.replace(/[^\d.]/g, ""))
  const power = sourcePowerHorsepower(overview.get("Maximum Power") || overview.get("Power"))
  const seats = asNumber((overview.get("Capacity") || overview.get("Seating Capacity"))?.replace(/[^\d]/g, ""))
  const doors = asNumber(overview.get("Doors")?.replace(/[^\d]/g, ""))
  const mileage = asNumber(overview.get("Mileage")?.replace(/[^\d]/g, ""))
  const lotNumber = overview.get("Stock No.") || candidate.sourceId
  const specs = [
    `Год выпуска: ${date[2]}`,
    `Месяц выпуска: ${date[2]}-${date[1]}`,
    `Пробег: ${mileage?.toLocaleString("ru-RU") || "уточняется"} км`,
    `Номер лота: ${lotNumber}`,
    engineVolume ? `Объём двигателя: ${Math.round(engineVolume).toLocaleString("ru-RU")} см³` : null,
    power ? `Мощность: ${power} л.с.` : null,
    fuelType ? `Топливо: ${fuelType}` : null,
    transmission ? `КПП: ${transmission}` : null,
    bodyType ? `Кузов: ${bodyType}` : null,
    driveType ? `Привод: ${driveType}` : null,
    seats ? `Количество мест: ${Math.round(seats)}` : null,
    doors ? `Количество дверей: ${Math.round(doors)}` : null,
    overview.get("Chassis No") ? `Номер шасси: ${overview.get("Chassis No")}` : null,
  ].filter((value): value is string => Boolean(value))
  return {
    source: "GOONET", sourceId: candidate.sourceId, sourceUrl: candidate.sourceUrl,
    sourceTitle: title,
    make, model, year: Number(date[2]), manufacturedMonth: `${date[2]}-${date[1]}`,
    sourcePrice: Math.round(sourcePrice), sourceCurrency: "JPY", country: "JP", auctionDate: null,
    mileage, fuelType,
    transmission, bodyType,
    color: asText(product.color), engineVolume,
    power, driveType,
    vin: overview.get("Chassis No") || null, lotNumber,
    imageUrl: images[0] || safeImage(asText(product.image), new Set(["picture1.goo-net.com"])), images,
    descriptionOrig: `${make} ${model}. Автомобиль опубликован в открытом каталоге Goo-net Exchange; характеристики приведены по карточке продавца.`,
    specsOrig: specs.join("; "),
    location: "Япония",
  }
}

async function fetchBobaedreamListing(candidate: PublicAuctionCandidate): Promise<AuctionImportItem> {
  if (!/^\d+$/.test(candidate.sourceId) || !candidate.sourceUrl.startsWith("https://www.bobaedream.co.kr/mycar/mycar_view.php?no=")) throw new Error("Некорректная карточка Bobaedream")
  const html = await sourceHtml("BOBAEDREAM", candidate.sourceUrl)
  const titleBlock = firstMatch(html, /<div class="title-area">[\s\S]*?<h3 class="tit">([\s\S]*?)<\/h3>/i)
  const title = htmlText(titleBlock)?.split("-")[0]?.trim() || null
  const priceTenThousandWon = asNumber(firstMatch(html, /<div class="price-area">[\s\S]*?<span class="price">\s*<b[^>]*>\s*([\d,]+)\s*<\/b>\s*만원/i)?.replace(/,/g, ""))
  if (!title || isBobaedreamSoldListing(html)) throw new PublicListingUnavailableError(`Bobaedream: карточка ${candidate.sourceId} снята с публикации`)

  const [rawMake, ...modelParts] = title.split(/\s+/)
  const make = normalizeAuctionMake(rawMake)
  const model = normalizeAuctionModel(modelParts.join(" "))
  if (!make || !model || /[\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/.test(make)) throw new Error(`Bobaedream: не распознаны марка или модель карточки ${candidate.sourceId}`)
  const pairs = tablePairs(html)
  const registration = pairs.get("연식")?.match(/(\d{4})\.(\d{2})/) || htmlText(firstMatch(html, /<p class="state">([\s\S]*?)<\/p>/i))?.match(/(\d{2})년\s*(\d{2})월/)
  if (!registration) throw new Error(`Bobaedream: нет даты выпуска карточки ${candidate.sourceId}`)
  const fullYear = registration[1].length === 2 ? 2000 + Number(registration[1]) : Number(registration[1])
  const month = registration[2]
  const bobaImageHosts = new Set(["file1.bobaedream.co.kr", "file2.bobaedream.co.kr", "file3.bobaedream.co.kr", "file4.bobaedream.co.kr", "file5.bobaedream.co.kr"])
  const images = [...new Set([...html.matchAll(/(?:https?:)?\/\/file[1-5]\.bobaedream\.co\.kr\/[^"]+?\.(?:jpg|jpeg|png)/gi)]
    .map((match) => safeImage(match[0], bobaImageHosts)).filter((url): url is string => Boolean(url)))].slice(0, 60)
  const engineText = pairs.get("배기량") || null
  const power = asNumber(engineText?.match(/([\d,]+)\s*마력/)?.[1]?.replace(/,/g, ""))
  const engineVolume = asNumber(engineText?.match(/([\d,]+)\s*cc/i)?.[1]?.replace(/,/g, ""))
  const mileage = asNumber(pairs.get("주행거리")?.replace(/[^\d]/g, ""))
  const fuelType = normalizeAuctionFuelType(pairs.get("연료"))
  const transmission = normalizeAuctionTransmission(pairs.get("변속기"))
  const rentalSummary = firstMatch(html, /<div class="price-area">([\s\S]*?)<\/div>\s*<div class="btn-area">/i) || ""
  const monthlyRentFromSummary = asNumber(firstMatch(rentalSummary, /<span class="stit">\s*월렌트료\s*<\/span>[\s\S]*?<span class="price">\s*<b[^>]*>\s*([\d,]+)\s*<\/b>\s*만원/i)?.replace(/,/g, ""))
  const rentalMonthsFromSummary = rentalSummary.match(/<span class="stit">\s*잔여개월\s*<\/span>[\s\S]*?<b[^>]*>\s*(\d+)\s*\/\s*(\d+)\s*<\/b>/i)
  const tableValue = (label: string) => {
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    return htmlText(firstMatch(html, new RegExp(`<th[^>]*>\\s*${escapedLabel}\\s*<\\/th>\\s*<td[^>]*>([\\s\\S]*?)<\\/td>`, "i")))
  }
  const monthlyRentWon = bobaedreamWon(pairs.get("월렌트료") || tableValue("월렌트료"))
    || (monthlyRentFromSummary !== null ? Math.round(monthlyRentFromSummary * 10_000) : null)
  const transferSupportWon = bobaedreamWon(pairs.get("승계지원금") || tableValue("승계지원금")) || 0
  const depositWon = bobaedreamWon(pairs.get("보증금") || tableValue("보증금"))
  const residualValueWon = bobaedreamWon(pairs.get("잔존가치") || tableValue("잔존가치"))
  const rentalPeriod = pairs.get("렌트기간") || tableValue("렌트기간") || ""
  const remainingMonths = asNumber(rentalPeriod.match(/잔여\s*(\d+)\s*개월/)?.[1]) || asNumber(rentalMonthsFromSummary?.[1])
  const totalMonths = asNumber(rentalPeriod.match(/총\s*(\d+)\s*개월/)?.[1]) || asNumber(rentalMonthsFromSummary?.[2])
  const isRentalTransfer = monthlyRentWon !== null && monthlyRentWon > 0 && remainingMonths !== null && remainingMonths > 0
  const estimatedRemainingContractWon = isRentalTransfer
    ? Math.max(1, Math.round(monthlyRentWon * remainingMonths - transferSupportWon))
    : null
  const regularSalePriceWon = priceTenThousandWon !== null ? Math.round(priceTenThousandWon * 10_000) : null
  const sourcePrice = estimatedRemainingContractWon || regularSalePriceWon
  if (!sourcePrice || sourcePrice <= 0) throw new Error(`Bobaedream: в карточке ${candidate.sourceId} не удалось определить стоимость`)

  const ownershipAfterEnd = /소유/.test(pairs.get("만기 후") || tableValue("만기 후") || "")
  const warranty = pairs.get("보증정보") || null
  const equipment = bobaedreamEquipment(html)
  const bodyType = /카니발|Carnival/i.test(title) ? "MINIVAN"
    : /팰리세이드|GV\d+|SUV|Range Rover|싼타페|쏘렌토/i.test(title) ? "SUV"
      : normalizeAuctionBodyType(pairs.get("차종"))
  const driveType = /\bAWD\b|4WD|사륜/i.test(title) ? "AWD" : null
  const location = /서울/.test(html) ? "Сеул" : /부산/.test(html) ? "Пусан" : "Корея"
  const russianSpecs = [
    `Год выпуска: ${fullYear}`,
    mileage !== null ? `Пробег: ${mileage.toLocaleString("ru-RU")} км` : null,
    fuelType ? `Топливо: ${fuelType}` : null,
    transmission ? `КПП: ${transmission}` : null,
    engineVolume ? `Объём: ${engineVolume.toLocaleString("ru-RU")} см³` : null,
    power ? `Мощность: ${Math.round(power)} л.с.` : null,
    isRentalTransfer ? `Тип предложения: переоформление долгосрочной аренды` : null,
    isRentalTransfer ? `Ежемесячный платёж: ${monthlyRentWon.toLocaleString("ru-RU")} ₩` : null,
    isRentalTransfer && totalMonths ? `Осталось по договору: ${remainingMonths} из ${totalMonths} месяцев` : null,
    isRentalTransfer && transferSupportWon ? `Компенсация при переоформлении: ${transferSupportWon.toLocaleString("ru-RU")} ₩` : null,
    isRentalTransfer && depositWon !== null ? `Депозит: ${depositWon.toLocaleString("ru-RU")} ₩` : null,
    isRentalTransfer && residualValueWon !== null ? `Остаточная стоимость: ${residualValueWon.toLocaleString("ru-RU")} ₩` : null,
    isRentalTransfer ? `Расчётный остаток регулярных платежей: ${estimatedRemainingContractWon?.toLocaleString("ru-RU")} ₩ — это не цена продажи автомобиля` : null,
  ].filter(Boolean).join("; ")
  const conditionInfo = isRentalTransfer ? {
    insuranceRecordCount: null,
    inspectionSummary: warranty ? `Гарантия источника: ${warranty.replace(/개월/g, " месяцев").replace(/km/gi, "км")}` : null,
    newCarPriceRatioPct: null,
    verifiedItems: [
      { label: "Тип предложения", status: "Переоформление долгосрочной аренды" },
      { label: "Ежемесячный платёж", status: `${monthlyRentWon.toLocaleString("ru-RU")} ₩` },
      { label: "Осталось по договору", status: totalMonths ? `${remainingMonths} из ${totalMonths} месяцев` : `${remainingMonths} месяцев` },
      { label: "Переход собственности", status: ownershipAfterEnd ? "После окончания договора" : "Условия нужно подтвердить" },
    ],
  } : null
  return {
    source: "BOBAEDREAM", sourceId: candidate.sourceId, sourceUrl: candidate.sourceUrl,
    sourceTitle: title,
    make, model, year: fullYear, manufacturedMonth: `${fullYear}-${month}`,
    sourcePrice, sourceCurrency: "KRW", country: "KR", auctionDate: null,
    mileage, fuelType,
    transmission, bodyType,
    color: pairs.get("색상") || null, engineVolume, power: power ? Math.round(power) : null,
    driveType, vin: null, lotNumber: candidate.sourceId,
    imageUrl: images[0] || null, images,
    descriptionOrig: isRentalTransfer
      ? `${make} ${model}. Переоформление долгосрочной аренды Bobaedream. Расчётный остаток регулярных платежей ${estimatedRemainingContractWon?.toLocaleString("ru-RU")} ₩; остаточная стоимость опубликована отдельно. Это не цена продажи автомобиля. Возможность выкупа и экспорта нужно подтвердить до расчёта доставки и таможенных платежей.`
      : `${make} ${model}. Автомобиль опубликован в открытом каталоге Bobaedream; данные проверяются по первоисточнику.`,
    specsOrig: russianSpecs || null,
    equipment,
    conditionInfo,
    location,
  }
}

async function fetchBeforwardListing(candidate: PublicAuctionCandidate): Promise<AuctionImportItem> {
  const path = candidate.sourceUrl.match(/^https:\/\/www\.beforward\.jp\/([a-z0-9-]+)\/([a-z0-9-]+)\/([a-z0-9-]+)\/id\/(\d+)\/$/i)
  if (!path || path[4] !== candidate.sourceId) throw new Error("Некорректная карточка BE FORWARD")
  const html = await sourceHtml("BEFORWARD", candidate.sourceUrl)
  if (!/"availability"\s*:\s*"https:\/\/schema\.org\/InStock"/i.test(html)) throw new PublicListingUnavailableError(`BE FORWARD: карточка ${candidate.sourceId} снята с публикации`)
  const sourcePrice = asNumber(firstMatch(html, /"price"\s*:\s*"([\d.]+)"/i))
  const make = normalizeAuctionMake(titleCaseSlug(path[1]))
  const model = normalizeAuctionModel(titleCaseSlug(path[2]))
  const pairs = tablePairs(html)
  const registrationText = pairs.get("Registration Year/month")
    || [...pairs.entries()].find(([key]) => key.replace(/\s+/g, "") === "RegistrationYear/month")?.[1]
    || htmlText(firstMatch(html, /Registration(?:\s|<br\s*\/?\s*>|<[^>]+>)*Year\/month[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i))
  const registered = registrationText?.match(/(\d{4})\/(\d{2})/)
  // Площадка убрала строку «Registration Year/month» из таблицы карточки, и
  // все лоты стали отсеиваться как неполные. Год остался в заголовке вида
  // «Used 2019 TOYOTA ALPHARD», поэтому он служит запасным источником: месяц
  // при этом неизвестен и не выдумывается.
  const sourceTitle = htmlText(firstMatch(html, /<title>([\s\S]*?)<\/title>/i))
  const titleYear = sourceTitle?.match(/\bUsed\s+((?:19|20)\d{2})\s/i)?.[1] || null
  const year = registered ? Number(registered[1]) : asNumber(titleYear)
  const manufacturedMonth = registered ? `${registered[1]}-${registered[2]}` : null
  if (!sourcePrice || !make || !model || !year) {
    const missing = [!sourcePrice && "цена", !make && "марка", !model && "модель", !year && "год"].filter(Boolean).join(", ")
    throw new Error(`BE FORWARD: в карточке ${candidate.sourceId} отсутствуют обязательные поля: ${missing}`)
  }
  const beforwardImageHosts = new Set(["image-cdn.beforward.jp"])
  const images = [...new Set([...html.matchAll(/(?:https?:)?\/\/image-cdn\.beforward\.jp\/[^"]+?\.(?:jpg|jpeg|png|webp)/gi)]
    .map((match) => safeImage(match[0], beforwardImageHosts)).filter((url): url is string => Boolean(url)))].slice(0, 60)
  const engineVolume = asNumber(pairs.get("Engine Size")?.replace(/[^\d.]/g, ""))
  const mileage = asNumber(pairs.get("Mileage")?.replace(/[^\d]/g, ""))
  const fuelType = normalizeAuctionFuelType(pairs.get("Fuel"))
  const transmission = normalizeAuctionTransmission(pairs.get("Transmission"))
  const bodyType = normalizeAuctionBodyType(
    pairs.get("Body Type")
      || pairs.get("BodyType")
      || pairs.get("Vehicle Type")
      || firstMatch(html, /\bspec_type=["']([^"']+)["']/i),
  )
  const driveType = normalizeAuctionDriveType(pairs.get("Drive"))
  const power = sourcePowerHorsepower(pairs.get("Max Power") || pairs.get("Maximum Power"))
  const seats = asNumber(pairs.get("Seats")?.replace(/[^\d]/g, ""))
  const doors = asNumber(pairs.get("Doors")?.replace(/[^\d]/g, ""))
  const lotNumber = pairs.get("Ref. No.") || path[3].toUpperCase()
  const location = pairs.get("Location") || pairs.get("Current Location") || "Япония"
  const specs = [
    `Год выпуска: ${year}`,
    manufacturedMonth ? `Месяц выпуска: ${manufacturedMonth}` : null,
    `Пробег: ${mileage?.toLocaleString("ru-RU") || "уточняется"} км`,
    `Номер лота: ${lotNumber}`,
    engineVolume ? `Объём двигателя: ${Math.round(engineVolume).toLocaleString("ru-RU")} см³` : null,
    power ? `Мощность: ${power} л.с.` : null,
    fuelType ? `Топливо: ${fuelType}` : null,
    transmission ? `КПП: ${transmission}` : null,
    bodyType ? `Кузов: ${bodyType}` : null,
    driveType ? `Привод: ${driveType}` : null,
    seats ? `Количество мест: ${Math.round(seats)}` : null,
    doors ? `Количество дверей: ${Math.round(doors)}` : null,
    pairs.get("Steering") ? `Руль: ${pairs.get("Steering")}` : null,
    pairs.get("Chassis No.") ? `Номер шасси: ${pairs.get("Chassis No.")}` : null,
    pairs.get("Model Code") ? `Код модели: ${pairs.get("Model Code")}` : null,
    `Местонахождение: ${location}`,
  ].filter((value): value is string => Boolean(value))
  return {
    source: "BEFORWARD", sourceId: candidate.sourceId, sourceUrl: candidate.sourceUrl,
    sourceTitle,
    make, model, year, manufacturedMonth,
    sourcePrice: Math.round(sourcePrice), sourceCurrency: "USD", country: "JP", auctionDate: null,
    mileage, fuelType,
    transmission, bodyType,
    color: pairs.get("Ext. Color") || null, engineVolume, power,
    driveType, vin: pairs.get("Chassis No.") || null,
    lotNumber, imageUrl: images[0] || null, images,
    descriptionOrig: `${make} ${model}. Автомобиль из открытого экспортного каталога BE FORWARD.`,
    specsOrig: specs.join("; "),
    location,
  }
}

async function fetchCarsensorListing(candidate: PublicAuctionCandidate): Promise<AuctionImportItem> {
  if (!/^AU\d+$/.test(candidate.sourceId) || candidate.sourceUrl !== `https://www.carsensor.net/usedcar/detail/${candidate.sourceId}/index.html`) throw new Error("Некорректная карточка CarSensor")
  const html = await sourceHtml("CARSENSOR", candidate.sourceUrl)
  const product = jsonLdObjects(html).find((value) => value["@type"] === "Product")
  if (!product) throw new PublicListingUnavailableError(`CarSensor: карточка ${candidate.sourceId} снята с публикации`)
  const brands = Array.isArray(product.brand) ? product.brand.map(asRecord).filter((value): value is UnknownRecord => Boolean(value)) : []
  const rawMake = asText(brands[0]?.name)
  const rawModel = asText(brands[1]?.name) || asText(product.model)
  const normalizedRawMake = rawMake?.normalize("NFKC") || null
  const make = normalizedRawMake ? normalizeAuctionMake(JAPANESE_MAKES[normalizedRawMake] || normalizedRawMake) : null
  const model = normalizeAuctionModel(rawModel ? romanizeJapanese(rawModel) : null)
  const offers = Array.isArray(product.offers) ? asRecord(product.offers[0]) : asRecord(product.offers)
  const sourcePrice = asNumber(asText(offers?.price)?.replace(/,/g, ""))
  const pairs = tablePairs(html)
  const year = pairs.get("年式(初度登録年)")?.match(/(\d{4})/)
  if (isCarsensorPriceOnRequest(sourcePrice)) throw new PublicListingPolicyExcludedError(`CarSensor: карточка ${candidate.sourceId} опубликована без реальной цены`)
  if (!make || !model || !sourcePrice || !year || /[\u3040-\u30FF\u3400-\u9FFF]/.test(make)) throw new Error(`CarSensor: неполная карточка ${candidate.sourceId}`)
  const carsensorImageHosts = new Set(["ccsrpcma.carsensor.net", "ccsrpcml.carsensor.net"])
  const images = [...new Set([...html.matchAll(/https:\/\/(?:ccsrpcma|ccsrpcml)\.carsensor\.net\/[^\s"')]+\.(?:jpg|jpeg|png|webp)/gi)]
    .map((match) => safeImage(match[0], carsensorImageHosts)).filter((url): url is string => Boolean(url)))].slice(0, 60)
  const mileageWan = asNumber(pairs.get("走行距離")?.match(/([\d.]+)万km/)?.[1])
  const mileageKm = mileageWan !== null ? Math.round(mileageWan * 10_000) : asNumber(pairs.get("走行距離")?.replace(/[^\d]/g, ""))
  const fuelType = normalizeAuctionFuelType(pairs.get("エンジン種別") || pairs.get("使用燃料"))
  const transmission = normalizeAuctionTransmission(pairs.get("ミッション"))
  const bodyType = normalizeAuctionBodyType(pairs.get("ボディタイプ"))
  const seats = asNumber(pairs.get("乗車定員")?.replace(/[^\d]/g, ""))
  const doors = asNumber(pairs.get("ドア数")?.replace(/[^\d]/g, ""))
  const repairHistory = pairs.get("修復歴") || null
  const noRepairHistory = repairHistory === "なし"
  const oneOwner = /[◯○]/.test(pairs.get("ワンオーナー") || "")
  const serviceRecord = /[◯○]/.test(pairs.get("定期点検記録簿") || "")
  const warrantyUntil = pairs.get("保証")?.match(/保証期限：(\d{4})年(\d{1,2})月/)
  const verifiedItems = [
    repairHistory ? { label: "История восстановительного ремонта", status: noRepairHistory ? "Источник не заявляет" : "Указана источником — требуется проверка" } : null,
    oneOwner ? { label: "Один владелец", status: "Отмечено источником" } : null,
    serviceRecord ? { label: "Документы техобслуживания", status: "Опубликованы источником" } : null,
  ].filter((item): item is { label: string; status: string } => Boolean(item))
  const specs = [
    `Год выпуска: ${year[1]}`,
    `Пробег: ${mileageKm?.toLocaleString("ru-RU") || "уточняется"} км`,
    `Номер лота: ${candidate.sourceId}`,
    seats ? `Количество мест: ${Math.round(seats)}` : null,
    doors ? `Количество дверей: ${Math.round(doors)}` : null,
    pairs.get("ハンドル") === "右" ? "Руль: правый" : pairs.get("ハンドル") === "左" ? "Руль: левый" : null,
    noRepairHistory ? "История восстановительного ремонта: источник не заявляет" : repairHistory ? "История восстановительного ремонта: указана источником — требуется проверка" : null,
    oneOwner ? "Количество владельцев: один по данным источника" : null,
    serviceRecord ? "Документы техобслуживания: опубликованы" : null,
    warrantyUntil ? `Гарантия продавца: до ${warrantyUntil[1]}-${warrantyUntil[2].padStart(2, "0")}` : null,
  ].filter((value): value is string => Boolean(value))
  return {
    source: "CARSENSOR", sourceId: candidate.sourceId, sourceUrl: candidate.sourceUrl,
    sourceTitle: asText(product.name),
    make, model, year: Number(year[1]), manufacturedMonth: null,
    sourcePrice: Math.round(sourcePrice), sourceCurrency: "JPY", country: "JP", auctionDate: null,
    mileage: mileageKm, fuelType,
    transmission, bodyType,
    color: pairs.get("色") || asText(product.color), engineVolume: asNumber(pairs.get("排気量")?.replace(/[^\d.]/g, "")),
    power: null, driveType: normalizeAuctionDriveType(pairs.get("駆動方式")), vin: null, lotNumber: candidate.sourceId,
    imageUrl: images[0] || null, images,
    descriptionOrig: `${make} ${model}. Автомобиль из открытого каталога CarSensor. Характеристики, гарантия и история обслуживания приведены по публичной карточке продавца.`,
    specsOrig: specs.join("; "),
    conditionInfo: verifiedItems.length ? {
      insuranceRecordCount: null,
      inspectionSummary: noRepairHistory
        ? "Источник не заявляет историю восстановительного ремонта"
        : repairHistory ? "Источник указывает историю восстановительного ремонта — требуется проверка" : null,
      newCarPriceRatioPct: null,
      verifiedItems,
    } : null,
    location: "Япония",
  }
}

async function fetchAutosaleListing(candidate: PublicAuctionCandidate): Promise<AuctionImportItem> {
  if (!/^\d+$/.test(candidate.sourceId) || candidate.sourceUrl !== `https://autosale.ee/listings/view.php?id=${candidate.sourceId}`) throw new Error("Некорректная карточка AutoSale")
  const html = await sourceHtml("AUTOSALE", candidate.sourceUrl)
  const car = jsonLdObjects(html).find((value) => value["@type"] === "Car")
  const offers = asRecord(car?.offers)
  if (!car || asText(offers?.availability) !== "https://schema.org/InStock") throw new PublicListingUnavailableError(`AutoSale: карточка ${candidate.sourceId} снята с публикации`)
  const make = normalizeAuctionMake(asText(asRecord(car.brand)?.name))
  const model = normalizeAuctionModel(car.model)
  const sourcePrice = asNumber(offers?.price)
  const year = asNumber(car.vehicleModelDate)
  if (!make || !model || !sourcePrice || !year) throw new Error(`AutoSale: неполная карточка ${candidate.sourceId}`)
  const imageValues = Array.isArray(car.image) ? car.image : [car.image]
  const images = [...new Set(imageValues.map(asText).map((url) => safeImage(url, new Set(["autosale.ee"]))).filter((url): url is string => Boolean(url)))].slice(0, 60)
  const mileage = asNumber(asRecord(car.mileageFromOdometer)?.value)
  const fuelType = normalizeAuctionFuelType(car.fuelType || asRecord(car.vehicleEngine)?.fuelType)
  const transmission = normalizeAuctionTransmission(car.vehicleTransmission)
  const bodyType = normalizeAuctionBodyType(car.bodyType || car.vehicleConfiguration)
  const engine = asRecord(car.vehicleEngine)
  const displacement = asRecord(engine?.engineDisplacement || car.engineDisplacement)
  const rawDisplacement = asNumber(displacement?.value) || asNumber(engine?.engineDisplacement) || asNumber(car.engineDisplacement)
  const engineVolume = normalizeAuctionEngineVolumeCc(rawDisplacement, fuelType)
  const enginePower = asRecord(engine?.enginePower || car.enginePower)
  const rawPower = enginePower
    ? `${asText(enginePower.value) || asNumber(enginePower.value) || ""} ${asText(enginePower.unitText) || asText(enginePower.unitCode) || ""}`
    : asText(engine?.enginePower) || asText(car.enginePower)
  const power = sourcePowerHorsepower(rawPower)
  const seats = asNumber(car.vehicleSeatingCapacity)
  const doors = asNumber(car.numberOfDoors)
  const vin = asText(car.vehicleIdentificationNumber)
  const sellerAddress = asRecord(asRecord(offers?.seller)?.address)
  const location = [asText(sellerAddress?.addressLocality), asText(sellerAddress?.addressCountry)].filter(Boolean).join(", ") || "Эстония"
  const specs = [
    `Год выпуска: ${Math.round(year)}`,
    `Пробег: ${mileage?.toLocaleString("ru-RU") || "уточняется"} км`,
    `Номер лота: ${candidate.sourceId}`,
    engineVolume ? `Объём двигателя: ${engineVolume.toLocaleString("ru-RU")} см³` : null,
    power ? `Мощность: ${power} л.с.` : null,
    fuelType ? `Топливо: ${fuelType}` : null,
    transmission ? `КПП: ${transmission}` : null,
    bodyType ? `Кузов: ${bodyType}` : null,
    seats ? `Количество мест: ${Math.round(seats)}` : null,
    doors ? `Количество дверей: ${Math.round(doors)}` : null,
    vin ? `VIN: ${vin}` : null,
    `Местонахождение: ${location}`,
  ].filter((value): value is string => Boolean(value))
  return {
    source: "AUTOSALE", sourceId: candidate.sourceId, sourceUrl: candidate.sourceUrl,
    sourceTitle: asText(car.name) || asText(car.model),
    make, model, year: Math.round(year), manufacturedMonth: null,
    sourcePrice: Math.round(sourcePrice), sourceCurrency: "EUR", country: "DE", auctionDate: null,
    mileage, fuelType,
    transmission, bodyType,
    color: asText(car.color), engineVolume, power, driveType: normalizeAuctionDriveType(car.driveWheelConfiguration), vin, lotNumber: candidate.sourceId,
    imageUrl: images[0] || null, images,
    descriptionOrig: `${make} ${model}. Автомобиль из открытого европейского каталога AutoSale.`,
    specsOrig: specs.join("; "),
    location,
  }
}

async function activeYouxinpaiCandidate(sourceId: string) {
  const maximumPage = publicSourceMaximumPage("YOUXINPAI")
  for (let firstPage = 1; firstPage <= maximumPage; firstPage += YOUXINPAI_CATALOG_SCAN_CONCURRENCY) {
    const pages = Array.from(
      { length: Math.min(YOUXINPAI_CATALOG_SCAN_CONCURRENCY, maximumPage - firstPage + 1) },
      (_, index) => firstPage + index,
    )
    const results = await Promise.allSettled(pages.map((page) => youxinpaiCatalogPage(page)))
    for (const result of results) {
      if (result.status !== "fulfilled") continue
      const candidate = result.value.find((value) => value.sourceId === sourceId)
      if (candidate) return candidate
    }

    // An incomplete catalogue scan must never be interpreted as proof that a
    // vehicle disappeared. Abort this refresh item so the next cron can retry.
    const failed = results.find((result): result is PromiseRejectedResult => result.status === "rejected")
    if (failed) throw failed.reason
  }
  return null
}

async function fetchYouxinpaiReport(sourceId: string) {
  const reportFieldsJson = await sourceHtml("YOUXINPAI", `https://api.youxinpai.cn/api/auction/detail/reportFields?publishId=${sourceId}`)
  let reportFields: UnknownRecord | null = null
  try {
    reportFields = asRecord(asRecord(JSON.parse(reportFieldsJson))?.data)
  } catch {
    throw new Error(`YouXinPai: повреждены поля отчёта ${sourceId}`)
  }
  if (!reportFields) throw new Error(`YouXinPai: отсутствуют поля отчёта ${sourceId}`)

  const reportUrlValue = asText(reportFields?.reportUrl)
  if (!reportUrlValue) return null
  const reportUrl = new URL(reportUrlValue)
  if (reportUrl.protocol !== "https:" || reportUrl.hostname !== "wos.youxinpai.cn") throw new Error(`YouXinPai: небезопасная ссылка отчёта ${sourceId}`)
  const response = await authorizedSourceGet(reportUrl.toString(), {
    allowedHosts: new Set(["wos.youxinpai.cn"]), headers: SOURCE_HEADERS,
    timeoutMs: SOURCE_TIMEOUT_MS, maxBytes: SOURCE_MAX_BYTES,
  })
  if (!response.ok) throw new Error(`YouXinPai: отчёт ${sourceId} вернул HTTP ${response.status}`)
  const jsonp = await response.text()
  const start = jsonp.indexOf("(")
  const end = jsonp.lastIndexOf(")")
  if (start < 0 || end <= start) throw new Error(`YouXinPai: повреждён отчёт ${sourceId}`)
  let reportData: UnknownRecord | null = null
  try {
    reportData = asRecord(asRecord(JSON.parse(jsonp.slice(start + 1, end)))?.data)
  } catch {
    throw new Error(`YouXinPai: повреждены данные отчёта ${sourceId}`)
  }
  return reportData ? { fields: reportFields, data: reportData } : null
}

async function fetchYouxinpaiListing(candidate: PublicAuctionCandidate): Promise<AuctionImportItem> {
  if (!/^\d+$/.test(candidate.sourceId)) throw new Error("Некорректная карточка YouXinPai")
  const hasCurrentCatalogPrice = candidate.referencePriceHigh !== undefined || candidate.openingPrice !== undefined
  const active = hasCurrentCatalogPrice && candidate.make && candidate.model && candidate.sourcePrice
    ? candidate
    : await activeYouxinpaiCandidate(candidate.sourceId)
  if (!active?.make || !active.model || !active.sourcePrice || !active.year) throw new PublicListingUnavailableError(`YouXinPai: карточка ${candidate.sourceId} снята с публикации`)
  const report = await fetchYouxinpaiReport(active.sourceId).catch(() => null)
  const basicInfo = asRecord(report?.data.basicInfo)
  const carInfo = asRecord(basicInfo?.carInfo)
  const certificate = asRecord(report?.data.certificateInfo)
  const carBaseInfo = asRecord(report?.data.carBaseInfo)
  const modelInfoValue = report?.data.modelInfo
  const modelInfo = Array.isArray(modelInfoValue) ? asRecord(modelInfoValue[0]) : asRecord(modelInfoValue)
  const detailInfo = asRecord(report?.data.detailInfo)
  const damageReport = youxinDamageReport(detailInfo)
  const reportImages = (Array.isArray(basicInfo?.carImages) ? basicInfo.carImages : []).flatMap((entry) => {
    const image = safeImage(asText(asRecord(entry)?.url), new Set(["img.youxinpai.cn"]))
    return image ? [image] : []
  })
  const images = [...new Set([...reportImages, ...(active.imageUrl ? [active.imageUrl] : [])])].slice(0, 60)
  const equipment = publicEquipment((Array.isArray(modelInfo?.configInfo) ? modelInfo.configInfo : []).flatMap((entry) => {
    const record = asRecord(entry)
    return asNumber(record?.status) === 0 ? [asText(record?.itemName)] : []
  }))
  const engineVolume = asNumber(certificate?.exhaust) || asNumber(active.model.match(/(\d+(?:\.\d+)?)\s*[LT]\b/i)?.[1])
  const power = asNumber(report?.fields.horsePower)
  const color = asText(carInfo?.carBodyColor) || asText(carBaseInfo?.carBodyColor)
  const city = asText(carInfo?.locationCityName) || asText(carBaseInfo?.cityName)
  const location = /^fuzhou$/i.test(city || "") ? "Фучжоу, Китай" : "Китай"
  const defectGroups = Array.isArray(detailInfo?.defects) ? detailInfo.defects : []
  const seriousDefects = defectGroups.reduce((total, value) => total + (asNumber(asRecord(value)?.seriousDefectItemCount) || 0), 0)
  const commonDefects = defectGroups.reduce((total, value) => total + (asNumber(asRecord(value)?.commonDefectItemCount) || 0), 0)
  const skeletonLevel = asText(carBaseInfo?.skeletonLevel)
  const appearanceLevel = asText(carBaseInfo?.appearanceLevel)
  const interiorLevel = asText(carBaseInfo?.interiorLevel)
  const reportSummary = report
    ? [appearanceLevel ? `кузов ${appearanceLevel}` : null, skeletonLevel ? `силовой каркас ${skeletonLevel}` : null, interiorLevel ? `салон ${interiorLevel}` : null].filter(Boolean).join(", ")
    : null
  const specs = [
    `Год выпуска: ${active.year}`,
    active.registrationMonth ? `Дата первой регистрации: ${active.registrationMonth}` : null,
    `Пробег: ${active.mileage?.toLocaleString("ru-RU") || "уточняется"} км`,
    `Номер лота: ${active.sourceId}`,
    active.referencePriceLow && active.referencePriceHigh
      ? `Ориентир цены источника: ${Math.round(active.referencePriceLow).toLocaleString("ru-RU")}–${Math.round(active.referencePriceHigh).toLocaleString("ru-RU")} CNY`
      : null,
    active.openingPrice ? `Стартовая ставка: ${Math.round(active.openingPrice).toLocaleString("ru-RU")} CNY` : null,
    active.currentBid ? `Текущая ставка: ${Math.round(active.currentBid).toLocaleString("ru-RU")} CNY` : null,
    `База предварительного расчёта: ${Math.round(active.sourcePrice).toLocaleString("ru-RU")} CNY`,
    engineVolume ? `Объём двигателя: ${engineVolume} л` : null,
    power ? `Мощность: ${Math.round(power)} л.с.` : null,
    asNumber(carInfo?.motorPower) ? `Мощность электромотора: ${Math.round(asNumber(carInfo?.motorPower) || 0)} кВт` : null,
    asNumber(carInfo?.enginePower) ? `Мощность ДВС: ${Math.round(asNumber(carInfo?.enginePower) || 0)} кВт` : null,
    asNumber(carInfo?.seatCount) ? `Количество мест: ${Math.round(asNumber(carInfo?.seatCount) || 0)}` : null,
    asNumber(carInfo?.keyCount) ? `Количество ключей: ${Math.round(asNumber(carInfo?.keyCount) || 0)}` : null,
    asText(carInfo?.effluentStandard) ? `Экологический стандарт: Китай VI` : null,
    `Местонахождение: ${location}`,
    seriousDefects === 0 && report ? "Серьёзные дефекты отчёта: не выявлены" : report ? `Серьёзные дефекты отчёта: ${seriousDefects}` : null,
    report ? `Замечания осмотра: ${commonDefects}` : null,
  ].filter((value): value is string => Boolean(value))
  return {
    source: "YOUXINPAI", sourceId: active.sourceId, sourceUrl: active.sourceUrl,
    sourceTitle: active.sourceTitle,
    make: active.make, model: active.model, year: active.year, manufacturedMonth: active.manufacturedMonth || null,
    sourcePrice: active.sourcePrice, sourceCurrency: "CNY", country: "CN", auctionDate: active.auctionDate || null,
    mileage: active.mileage ?? null, fuelType: active.fuelType || null, transmission: active.transmission || null,
    bodyType: active.bodyType || null, color, engineVolume, power, driveType: equipment?.items.some((item) => item.label === "Полный привод") ? "AWD" : null, vin: null,
    lotNumber: active.sourceId, imageUrl: images[0] || null, images,
    descriptionOrig: `${active.make} ${active.model}, ${active.year} года. Предварительный расчёт использует верхний публичный ценовой ориентир, а не минимальную стартовую ставку. В открытом отчёте YouXinPai опубликованы ${reportImages.length || "доступные"} фотографий автомобиля${equipment ? ` и ${equipment.items.length} распознанных опций` : ""}. Валюта китайского каталога — CNY; данные осмотра, итоговую цену и комплектацию необходимо подтвердить перед сделкой.`,
    specsOrig: specs.join("; "), equipment,
    conditionInfo: report ? {
      insuranceRecordCount: null,
      inspectionSummary: reportSummary ? `Отчёт YouXinPai: ${reportSummary}` : "Открытый отчёт осмотра YouXinPai",
      newCarPriceRatioPct: null,
      verifiedItems: [
        { label: "Серьёзные дефекты", status: seriousDefects === 0 ? "Не выявлены в открытом отчёте" : `Указано: ${seriousDefects}` },
        { label: "Замечания осмотра", status: commonDefects === 0 ? "Не указаны" : `Указано: ${commonDefects}` },
        { label: "Пробег по отчёту", status: report.fields.isMileageTampered === 0 ? "Признаков корректировки не указано" : "Требуется дополнительная проверка" },
      ],
      damageReport,
    } : null,
    location,
  }
}

function nextData(html: string) {
  const marker = html.indexOf("__NEXT_DATA__")
  if (marker < 0) return null
  const start = html.indexOf(">", marker) + 1
  const end = html.indexOf("</script>", start)
  if (start <= 0 || end <= start) return null
  try { return JSON.parse(html.slice(start, end)) as UnknownRecord } catch { return null }
}

function carBodyFromClass(value: string | null) {
  if (!value) return null
  if (/SUV/i.test(value)) return "SUV"
  if (/WAGON|ESTATE/i.test(value)) return "WAGON"
  if (/VAN|MPV/i.test(value)) return "MINIVAN"
  if (/COUPE/i.test(value)) return "COUPE"
  if (/HATCH/i.test(value)) return "HATCHBACK"
  if (/SEDAN|SALOON/i.test(value)) return "SEDAN"
  return null
}

async function fetchCarvagoListing(candidate: PublicAuctionCandidate): Promise<AuctionImportItem> {
  if (!/^\d+$/.test(candidate.sourceId) || !candidate.sourceUrl.startsWith(`https://carvago.com/car/${candidate.sourceId}/`)) throw new Error("Некорректная карточка Carvago")
  const html = await sourceHtml("CARVAGO", candidate.sourceUrl)
  const root = nextData(html)
  const pageProps = asRecord(asRecord(asRecord(root?.props)?.pageProps))
  const car = asRecord(pageProps?.carData)
  if (!car || pageProps?.carUnavailable === true || asText(car.status) !== "active" || car.tradable === false) throw new PublicListingUnavailableError(`Carvago: карточка ${candidate.sourceId} снята с публикации`)
  const make = normalizeAuctionMake(asText(asRecord(car.make)?.label))
  const model = normalizeAuctionModel(asText(asRecord(car.model)?.label) || asText(car.title))
  const registrationDate = asText(car.registration_date) || asText(car.manufacture_date)
  const date = registrationDate?.match(/^(\d{4})-(0[1-9]|1[0-2])-/)
  const price = asNumber(asRecord(asRecord(car.price_information)?.nice_price_data)?.price)
  if (String(car.id) !== candidate.sourceId || !make || !model || !date || !price) throw new Error(`Carvago: неполная карточка ${candidate.sourceId}`)
  const images = (Array.isArray(car.images) ? car.images : []).flatMap((entry) => {
    const url = safeImage(asText(asRecord(entry)?.path), new Set(["storage.alpha-analytics.cz"]))
    return url ? [url] : []
  }).slice(0, 60)
  const metaDescription = decodeHtml(firstMatch(html, /<meta\s+name="description"\s+content="([^"]*)"/i) || "") || null
  const catalogFeatures = (Array.isArray(car.catalog_features) ? car.catalog_features : []).flatMap((entry) => {
    const record = asRecord(entry)
    return record ? [record] : []
  })
  const featureByPrefix = (prefix: string) => catalogFeatures.find((entry) => asText(entry.const_key)?.startsWith(prefix)) || null
  const electricInfo = asRecord(car.electric_vehicle_feature)
  const electric = Boolean(asNumber(electricInfo?.battery_capacity_kwh))
  const fuelFeature = featureByPrefix("FUELTYPE_")
  const transmissionFeature = featureByPrefix("TRANSMISSION_")
  const bodyFeature = featureByPrefix("CARSTYLE_")
  const colorFeature = featureByPrefix("COLOR_")
  const driveFeature = featureByPrefix("DRIVE_")
  const fuelType = electric ? "ELECTRIC" : normalizeAuctionFuelType(asText(fuelFeature?.label) || metaDescription?.match(/\b(Electric|Diesel|Petrol|Hybrid)\b/i)?.[1])
  const transmission = normalizeAuctionTransmission(asText(transmissionFeature?.label) || metaDescription?.match(/\b(Automatic|Manual)\b/i)?.[1])
  const bodyType = normalizeAuctionBodyType(asText(bodyFeature?.label)) || carBodyFromClass(asText(car.vehicle_class))
  const equipment = publicEquipment(catalogFeatures.flatMap((entry) => asText(entry.const_key)?.startsWith("FEATURE_") ? [asText(entry.label)] : []))
  const locationCountry = asRecord(car.location_country)
  const locationCountryCode = asText(locationCountry?.iso_code)?.toLocaleUpperCase("en-US") || ""
  const countryLabel = CARVAGO_COUNTRY_LABELS[locationCountryCode] || "Европа"
  const sourceCity = asText(car.location_city)?.toLocaleLowerCase("en-US") || ""
  const cityLabel = CARVAGO_CITY_LABELS[sourceCity]
  const location = cityLabel ? `${cityLabel}, ${countryLabel}` : countryLabel
  const seller = asRecord(car.seller)
  const sellerType = asText(asRecord(seller?.type)?.const_key) === "SELLERTYPE_DEALERSHIP" ? "Автодилер" : "Продавец"
  const priceInformation = asRecord(car.price_information)
  const nicePrice = asRecord(priceInformation?.nice_price_data)
  const discount = asRecord(priceInformation?.discount_data)
  const emission = asRecord(car.emission)
  const driveLabel = asText(driveFeature?.label)?.replace(/4x2/i, "4×2") || null
  const interior = asText(featureByPrefix("INTERIORMATERIAL_")?.label)
  const specs = [
    `Год выпуска: ${Number(date[1])}`,
    `Пробег: ${(asNumber(car.mileage) || 0).toLocaleString("ru-RU")} км`,
    `Номер лота: ${candidate.sourceId}`,
    asNumber(car.power_hp) ? `Мощность: ${Math.round(asNumber(car.power_hp) || 0)} л.с.` : null,
    asNumber(car.power_kw) || asNumber(electricInfo?.power_electric_engine) ? `Мощность: ${Math.round(asNumber(car.power_kw) || asNumber(electricInfo?.power_electric_engine) || 0)} кВт` : null,
    driveLabel ? `Колёсная формула: ${driveLabel}` : null,
    interior ? `Материал салона: ${/cloth/i.test(interior) ? "ткань" : interior}` : null,
    asNumber(electricInfo?.battery_capacity_kwh) ? `Ёмкость батареи: ${asNumber(electricInfo?.battery_capacity_kwh)} кВт·ч` : null,
    asNumber(electricInfo?.electric_range_min) ? `Запас хода: ${asNumber(electricInfo?.electric_range_min)}–${asNumber(electricInfo?.electric_range_max) || asNumber(electricInfo?.electric_range_min)} км` : null,
    asNumber(electricInfo?.charging_time_dc_min) ? `Быстрая зарядка: ${asNumber(electricInfo?.charging_time_dc_min)}–${asNumber(electricInfo?.charging_time_dc_max) || asNumber(electricInfo?.charging_time_dc_min)} мин` : null,
    asNumber(electricInfo?.charging_time_ac) ? `Зарядка переменным током: ${asNumber(electricInfo?.charging_time_ac)} ч` : null,
    asNumber(emission?.fuel_consumption) ? `Расход энергии: ${asNumber(emission?.fuel_consumption)} кВт·ч/100 км` : null,
    asText(emission?.co2_class) ? `Экологический класс: ${asText(emission?.co2_class)}` : null,
    `Местонахождение: ${location}`,
    priceInformation?.vat_reclaimable === true ? "НДС: доступен к возмещению" : null,
    asNumber(nicePrice?.price_without_vat) ? `Цена без НДС: ${Math.round(asNumber(nicePrice?.price_without_vat) || 0).toLocaleString("ru-RU")} €` : null,
  ].filter((value): value is string => Boolean(value))
  return {
    source: "CARVAGO", sourceId: candidate.sourceId, sourceUrl: candidate.sourceUrl,
    sourceTitle: asText(car.title),
    make, model, year: Number(date[1]), manufacturedMonth: `${date[1]}-${date[2]}`,
    sourcePrice: Math.round(price), sourceCurrency: "EUR", country: "DE", auctionDate: null,
    mileage: asNumber(car.mileage), fuelType, transmission, bodyType,
    color: asText(colorFeature?.label), engineVolume: electric ? null : asNumber(car.cubic_capacity), power: asNumber(car.power_hp),
    driveType: normalizeAuctionDriveType(asText(driveFeature?.label)), vin: asText(car.vin), lotNumber: candidate.sourceId,
    imageUrl: images[0] || safeImage(asText(asRecord(car.image)?.path), new Set(["storage.alpha-analytics.cz"])), images,
    descriptionOrig: `${electric ? "Электромобиль" : "Автомобиль"} ${make} ${model}, ${Number(date[1])} года, пробег ${(asNumber(car.mileage) || 0).toLocaleString("ru-RU")} км. ${sellerType} находится в ${location}. В открытой карточке Carvago опубликованы ${images.length} фотографий${equipment ? ` и ${equipment.items.length} распознанных опций` : ""}.`,
    specsOrig: specs.join("; "), equipment,
    conditionInfo: {
      insuranceRecordCount: null,
      inspectionSummary: "Публичные данные продавца и комплектации Carvago",
      newCarPriceRatioPct: null,
      verifiedItems: [
        { label: "Местонахождение", status: location },
        { label: "Тип продавца", status: sellerType },
        { label: "НДС", status: priceInformation?.vat_reclaimable === true ? "Доступен к возмещению" : "Уточняется у продавца" },
        ...(asNumber(discount?.price) ? [{ label: "Снижение цены", status: `${Math.round(asNumber(discount?.price) || 0).toLocaleString("ru-RU")} €` }] : []),
      ],
    },
    location,
  }
}

/**
 * Разбирает карточку и отсеивает машины мощнее порога льготного утильсбора.
 *
 * Проверка стоит здесь, а не в каждом из восьми разборщиков: так правило
 * действует на все площадки сразу и не может быть забыто при добавлении
 * новой. У Iautos есть ещё и ранняя проверка внутри разборщика — она
 * экономит платный перевод названия, который иначе тратился бы впустую.
 */
export async function fetchPublicAuctionListing(source: PublicAuctionSource, candidate: PublicAuctionCandidate) {
  const item = await fetchPublicAuctionListingRaw(source, candidate)
  // Encar, Carsensor, BE FORWARD и Goo-net не публикуют мощность, хотя от неё
  // зависит утилизационный сбор — разница между льготной и коммерческой
  // ставкой доходит до сотен раз. Справочник восстанавливает её по модели и
  // обозначению двигателя в названии комплектации; неизвестная остаётся
  // неизвестной, догадка здесь опаснее пропуска.
  if (!item.power) {
    const referencePower = lookupVehiclePower(item.make, item.model)
    if (referencePower) return { ...item, power: referencePower }
  }
  return item
}

function fetchPublicAuctionListingRaw(source: PublicAuctionSource, candidate: PublicAuctionCandidate) {
  if (source === "IAUTOS") return fetchIautosListing(candidate)
  if (source === "YOUXINPAI") return fetchYouxinpaiListing(candidate)
  if (source === "GOONET") return fetchGoonetListing(candidate)
  if (source === "BEFORWARD") return fetchBeforwardListing(candidate)
  if (source === "CARSENSOR") return fetchCarsensorListing(candidate)
  if (source === "AUTOSALE") return fetchAutosaleListing(candidate)
  if (source === "BOBAEDREAM") return fetchBobaedreamListing(candidate)
  return fetchCarvagoListing(candidate)
}
