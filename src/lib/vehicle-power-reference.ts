/**
 * Справочник мощности для источников, которые её не публикуют.
 *
 * Encar, Carsensor, BE FORWARD и Goo-net отдают объём двигателя и название
 * комплектации, но не мощность. Без неё нельзя сказать, попадает машина под
 * льготный утилизационный сбор или под коммерческий, а разница доходит до
 * сотен раз — 5 200 ₽ против 1 363 000 ₽.
 *
 * Выводить мощность из одного объёма нельзя: у двухлитрового мотора она
 * бывает и 150, и 250 л.с. в зависимости от наддува. Поэтому справочник
 * опирается на связку «модель + обозначение двигателя», которую площадки
 * пишут в названии комплектации: «G80 Gasoline 2.5 Turbo AWD»,
 * «Palisade Diesel 2.2 2WD».
 *
 * Значения — заводские паспортные для корейского рынка. Если модели нет в
 * справочнике, мощность остаётся неизвестной: догадка здесь опаснее пропуска,
 * потому что ошибка в двадцать лошадиных сил меняет сбор в сотни раз.
 */

type PowerRule = {
  /** Часть названия модели, по которой узнаётся семейство. */
  model: RegExp
  /** Обозначение двигателя внутри названия комплектации. */
  engine: RegExp
  /** Мощность в лошадиных силах. */
  power: number
}

/**
 * Правила проверяются сверху вниз: более узкие идут раньше.
 *
 * Турбированные версии обязаны стоять перед атмосферными того же объёма,
 * иначе «2.5 Turbo» совпадёт с правилом для «2.5» и вернёт заниженную
 * мощность — а это ровно та ошибка, которая переводит машину из
 * коммерческой ставки в льготную и обманывает покупателя на миллион.
 */
const POWER_RULES: ReadonlyArray<PowerRule> = [
  // Genesis
  { model: /\bG90\b/i, engine: /3\.5\s*turbo/i, power: 415 },
  { model: /\bG80\b/i, engine: /3\.5\s*turbo/i, power: 380 },
  { model: /\bG80\b/i, engine: /2\.5\s*turbo/i, power: 304 },
  { model: /\bG70\b/i, engine: /3\.3\s*turbo/i, power: 370 },
  { model: /\bG70\b/i, engine: /2\.0\s*turbo/i, power: 252 },
  { model: /\bGV80\b/i, engine: /3\.5\s*turbo/i, power: 380 },
  { model: /\bGV80\b/i, engine: /2\.5\s*t/i, power: 304 },
  { model: /\bGV80\b/i, engine: /diesel\s*3\.0|3\.0\s*diesel/i, power: 278 },
  { model: /\bGV70\b/i, engine: /3\.5\s*turbo/i, power: 380 },
  { model: /\bGV70\b/i, engine: /2\.5\s*t/i, power: 304 },
  { model: /\bGV60\b/i, engine: /./, power: 320 },

  // Hyundai
  { model: /\bPalisade\b/i, engine: /diesel\s*2\.2|2\.2\s*diesel/i, power: 202 },
  { model: /\bPalisade\b/i, engine: /3\.8/i, power: 295 },
  { model: /\bPalisade\b/i, engine: /2\.5/i, power: 281 },
  { model: /\bGrandeur\b/i, engine: /3\.5/i, power: 300 },
  { model: /\bGrandeur\b/i, engine: /2\.5/i, power: 198 },
  { model: /\bGrandeur\b/i, engine: /hybrid|1\.6\s*turbo/i, power: 180 },
  { model: /\bSonata\b/i, engine: /2\.5\s*turbo/i, power: 290 },
  { model: /\bSonata\b/i, engine: /1\.6\s*turbo/i, power: 180 },
  { model: /\bSonata\b/i, engine: /2\.0/i, power: 160 },
  { model: /\bAVANTE\b|\bElantra\b/i, engine: /1\.6\s*turbo/i, power: 204 },
  { model: /\bAVANTE\b|\bElantra\b/i, engine: /1\.6/i, power: 123 },
  { model: /\bTUCSON\b/i, engine: /1\.6\s*turbo/i, power: 180 },
  { model: /\bTUCSON\b/i, engine: /2\.0\s*diesel|diesel\s*2\.0/i, power: 186 },
  { model: /\bSANTA\s*FE\b/i, engine: /2\.5\s*turbo/i, power: 281 },
  { model: /\bSANTA\s*FE\b/i, engine: /2\.2\s*diesel|diesel\s*2\.2/i, power: 202 },
  { model: /\bCasper\b/i, engine: /turbo/i, power: 100 },
  { model: /\bCasper\b/i, engine: /./, power: 76 },
  { model: /\bVENUE\b/i, engine: /./, power: 123 },
  { model: /\bKONA\b/i, engine: /1\.6\s*turbo/i, power: 198 },
  { model: /\bSTARIA\b/i, engine: /2\.2/i, power: 177 },

  // Kia
  { model: /\bRAY\b/i, engine: /./, power: 76 },
  { model: /\bMORNING\b|\bPicanto\b/i, engine: /./, power: 76 },
  { model: /\bK5\b/i, engine: /1\.6\s*turbo/i, power: 180 },
  { model: /\bK5\b/i, engine: /2\.0/i, power: 160 },
  { model: /\bK8\b/i, engine: /3\.5/i, power: 300 },
  { model: /\bK8\b/i, engine: /2\.5/i, power: 198 },
  { model: /\bK9\b/i, engine: /3\.8/i, power: 315 },
  { model: /\bSorento\b/i, engine: /2\.2\s*diesel|diesel\s*2\.2/i, power: 202 },
  { model: /\bSorento\b/i, engine: /2\.5\s*turbo/i, power: 281 },
  { model: /\bSportage\b/i, engine: /1\.6\s*turbo/i, power: 180 },
  { model: /\bSportage\b/i, engine: /2\.0\s*diesel|diesel\s*2\.0/i, power: 186 },
  { model: /\bCani?val\b|\bCarnival\b/i, engine: /2\.2\s*diesel|diesel/i, power: 202 },
  { model: /\bCani?val\b|\bCarnival\b/i, engine: /3\.5|gasoline/i, power: 294 },
  { model: /\bSeltos\b/i, engine: /1\.6\s*turbo/i, power: 177 },
  { model: /\bSeltos\b/i, engine: /./, power: 123 },
  { model: /\bNiro\b/i, engine: /./, power: 141 },
  { model: /\bEV6\b/i, engine: /./, power: 229 },
  { model: /\bEV9\b/i, engine: /./, power: 384 },

  // KGM / SsangYong
  { model: /\bTorres\b/i, engine: /1\.5/i, power: 170 },
  { model: /\bTIBOLI\b|\bTivoli\b/i, engine: /1\.5/i, power: 163 },
  { model: /\bRexton\b/i, engine: /2\.2/i, power: 202 },
  { model: /\bKorando\b/i, engine: /1\.5/i, power: 170 },

  // Корейские модели без указания двигателя в названии: комплектация есть,
  // мотор не назван, но у этих машин он единственный.
  { model: /\bIoniq\s*5\b/i, engine: /./, power: 217 },
  { model: /\bIoniq\s*6\b/i, engine: /./, power: 229 },
  { model: /\bMohave\b/i, engine: /3\.0/i, power: 260 },
  { model: /\bK3\b/i, engine: /1\.6/i, power: 123 },
  { model: /\bGrand\s*Koleos\b/i, engine: /1\.5/i, power: 156 },

  // Немецкие марки обозначают мотор индексом в названии: «320i», «E250».
  // Индекс надёжнее объёма, потому что прямо называет ступень мощности.
  { model: /\bBMW\b|\bSeries\b/i, engine: /\b(?:118|120)i\b/i, power: 156 },
  { model: /\bBMW\b|\bSeries\b/i, engine: /\b320i\b/i, power: 184 },
  { model: /\bBMW\b|\bSeries\b/i, engine: /\b330i\b/i, power: 258 },
  { model: /\bBMW\b|\bSeries\b/i, engine: /\b520i\b/i, power: 184 },
  { model: /\bBMW\b|\bSeries\b/i, engine: /\b530i\b/i, power: 252 },
  { model: /\bMercedes|\bE-Class\b/i, engine: /\bE200\b/i, power: 197 },
  { model: /\bMercedes|\bE-Class\b/i, engine: /\bE250\b/i, power: 211 },
  { model: /\bMercedes|\bE-Class\b/i, engine: /\bE300\b/i, power: 258 },
  { model: /\bMercedes|\bC-Class\b/i, engine: /\bC200\b/i, power: 204 },
  { model: /\bMercedes|\bCLA\b/i, engine: /\bCLA250\b/i, power: 224 },
  { model: /\bAudi\b/i, engine: /\b35\s*TFSI\b/i, power: 150 },
  { model: /\bAudi\b/i, engine: /\b40\s*TFSI\b/i, power: 204 },
  { model: /\bAudi\b/i, engine: /\b45\s*TFSI\b/i, power: 245 },

  // Японские кей-кары. Класс ограничен законом Японии 64 л.с., поэтому
  // мощность известна по самой принадлежности к классу.
  { model: /\btanto\b|\bmiraisu\b|\bmira\b|\bmuvu\b|\btafuto\b|\bhaizetto\b|\bcopen\b/i, engine: /./, power: 64 },
  { model: /\bN-BOX\b|\bN-WGN\b|\bN-ONE\b|\bN-VAN\b/i, engine: /./, power: 64 },
  { model: /\bwagon\s*r\b|\balto\b|\bhustler\b|\bspacia\b|\bjimny\b/i, engine: /./, power: 64 },
  { model: /\bdayz\b|\broox\b|\bekuwagon\b/i, engine: /./, power: 64 },

  // Японские модели среднего класса.
  { model: /\bVellfire\b|\bAlphard\b/i, engine: /hybrid/i, power: 250 },
  { model: /\bVellfire\b|\bAlphard\b/i, engine: /./, power: 182 },
  { model: /\bPrius\b/i, engine: /./, power: 122 },
  { model: /\bAqua\b/i, engine: /./, power: 116 },
  { model: /\bFit\b|\bJazz\b/i, engine: /./, power: 98 },
  { model: /\bNote\b/i, engine: /./, power: 116 },
  { model: /\bSerena\b/i, engine: /./, power: 150 },
  { model: /\bFreed\b/i, engine: /./, power: 131 },
  { model: /\bSienta\b/i, engine: /./, power: 116 },
  { model: /\bRoomy\b|\bTank\b/i, engine: /./, power: 98 },
]

/**
 * Пытается определить мощность по названию модели и комплектации.
 *
 * Возвращает null, когда модель не найдена: неизвестная мощность честнее
 * выдуманной, потому что от неё зависит сумма сбора.
 */
export function lookupVehiclePower(make: string | null | undefined, model: string | null | undefined): number | null {
  const haystack = `${make || ""} ${model || ""}`.trim()
  if (!haystack) return null

  for (const rule of POWER_RULES) {
    if (rule.model.test(haystack) && rule.engine.test(haystack)) return rule.power
  }
  return null
}
