-- Подразделы форума.
--
-- Плоский список из двадцати трёх разделов не вмещает того, как люди
-- на самом деле ищут. Владельцу Camry нужен не «японские автомобили», а
-- раздел про его марку; жителю Сургута — не «Уральский округ», а свой
-- город. Так устроен drom.ru, и так устроен поисковый запрос: каждый
-- подраздел получает отдельную страницу под «форум Toyota» или
-- «авторынок Владивосток».

ALTER TABLE "ForumSection" ADD COLUMN "parentId" TEXT REFERENCES "ForumSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ForumSection_parentId_position_idx" ON "ForumSection"("parentId", "position");

-- yaponskie-avto
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-toyota', 'toyota', 'Toyota', 'Camry, Corolla, RAV4, Land Cruiser, Prado', "groupKey", 1, "id" FROM "ForumSection" WHERE "slug" = 'yaponskie-avto';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-nissan', 'nissan', 'Nissan', 'X-Trail, Qashqai, Almera, Teana, Patrol', "groupKey", 2, "id" FROM "ForumSection" WHERE "slug" = 'yaponskie-avto';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-honda', 'honda', 'Honda', 'CR-V, Accord, Civic, Fit, Pilot', "groupKey", 3, "id" FROM "ForumSection" WHERE "slug" = 'yaponskie-avto';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-mazda', 'mazda', 'Mazda', 'Mazda3, Mazda6, CX-5, CX-9', "groupKey", 4, "id" FROM "ForumSection" WHERE "slug" = 'yaponskie-avto';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-subaru', 'subaru', 'Subaru', 'Forester, Outback, Impreza, XV', "groupKey", 5, "id" FROM "ForumSection" WHERE "slug" = 'yaponskie-avto';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-mitsubishi', 'mitsubishi', 'Mitsubishi', 'Outlander, Pajero, Lancer, ASX', "groupKey", 6, "id" FROM "ForumSection" WHERE "slug" = 'yaponskie-avto';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-lexus', 'lexus', 'Lexus', 'RX, NX, LX, ES, GX', "groupKey", 7, "id" FROM "ForumSection" WHERE "slug" = 'yaponskie-avto';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-suzuki-isuzu', 'suzuki-isuzu', 'Suzuki и Isuzu', 'Vitara, SX4, Jimny, Elf, Bighorn', "groupKey", 8, "id" FROM "ForumSection" WHERE "slug" = 'yaponskie-avto';

-- nemeckie-avto
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-volkswagen', 'volkswagen', 'Volkswagen', 'Tiguan, Polo, Passat, Touareg', "groupKey", 1, "id" FROM "ForumSection" WHERE "slug" = 'nemeckie-avto';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-bmw', 'bmw', 'BMW', '3-я серия, 5-я серия, X3, X5, X7', "groupKey", 2, "id" FROM "ForumSection" WHERE "slug" = 'nemeckie-avto';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-mercedes', 'mercedes', 'Mercedes-Benz', 'E-класс, C-класс, GLE, GLC, S-класс', "groupKey", 3, "id" FROM "ForumSection" WHERE "slug" = 'nemeckie-avto';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-audi', 'audi', 'Audi', 'A4, A6, Q5, Q7, Q8', "groupKey", 4, "id" FROM "ForumSection" WHERE "slug" = 'nemeckie-avto';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-opel-porsche', 'opel-porsche', 'Opel и Porsche', 'Astra, Insignia, Cayenne, Macan', "groupKey", 5, "id" FROM "ForumSection" WHERE "slug" = 'nemeckie-avto';

-- koreyskie-avto
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-hyundai', 'hyundai', 'Hyundai', 'Solaris, Creta, Tucson, Santa Fe, Palisade', "groupKey", 1, "id" FROM "ForumSection" WHERE "slug" = 'koreyskie-avto';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-kia', 'kia', 'Kia', 'Rio, Sportage, Sorento, Seltos, K5', "groupKey", 2, "id" FROM "ForumSection" WHERE "slug" = 'koreyskie-avto';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-genesis-ssangyong', 'genesis-ssangyong', 'Genesis и SsangYong', 'G70, G80, GV70, Rexton, Actyon', "groupKey", 3, "id" FROM "ForumSection" WHERE "slug" = 'koreyskie-avto';

-- kitayskie-avto
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-haval', 'haval', 'Haval', 'Jolion, F7, Dargo, H9', "groupKey", 1, "id" FROM "ForumSection" WHERE "slug" = 'kitayskie-avto';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-chery-exeed', 'chery-exeed', 'Chery и Exeed', 'Tiggo 4, Tiggo 7, Tiggo 8, LX, TXL', "groupKey", 2, "id" FROM "ForumSection" WHERE "slug" = 'kitayskie-avto';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-geely', 'geely', 'Geely', 'Coolray, Atlas, Monjaro, Tugella', "groupKey", 3, "id" FROM "ForumSection" WHERE "slug" = 'kitayskie-avto';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-changan-omoda', 'changan-omoda', 'Changan, Omoda, Jaecoo', 'CS35, CS75, UNI-K, C5, J7', "groupKey", 4, "id" FROM "ForumSection" WHERE "slug" = 'kitayskie-avto';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-li-zeekr-byd', 'li-zeekr-byd', 'Li Auto, Zeekr, BYD', 'L7, L9, 001, 007, Song, Han', "groupKey", 5, "id" FROM "ForumSection" WHERE "slug" = 'kitayskie-avto';

-- amerikanskie-avto
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-ford-chevrolet', 'ford-chevrolet', 'Ford и Chevrolet', 'Focus, Kuga, Explorer, Tahoe, Camaro', "groupKey", 1, "id" FROM "ForumSection" WHERE "slug" = 'amerikanskie-avto';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-jeep-dodge-tesla', 'jeep-dodge-tesla', 'Jeep, Dodge, Tesla', 'Wrangler, Grand Cherokee, RAM, Model 3', "groupKey", 2, "id" FROM "ForumSection" WHERE "slug" = 'amerikanskie-avto';

-- otechestvennye-avto
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-lada', 'lada', 'LADA', 'Vesta, Granta, Niva, Largus, Iskra', "groupKey", 1, "id" FROM "ForumSection" WHERE "slug" = 'otechestvennye-avto';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-uaz-gaz', 'uaz-gaz', 'УАЗ и ГАЗ', 'Патриот, Хантер, Соболь, ГАЗель', "groupKey", 2, "id" FROM "ForumSection" WHERE "slug" = 'otechestvennye-avto';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-moskvich-retro', 'moskvich-retro', 'Москвич и ретро', 'Москвич 3, Москвич 6, Волга, классика ВАЗ', "groupKey", 3, "id" FROM "ForumSection" WHERE "slug" = 'otechestvennye-avto';

-- evropeyskie-avto
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-renault-peugeot-citroen', 'renault-peugeot-citroen', 'Renault, Peugeot, Citroen', 'Duster, Logan, 3008, C4', "groupKey", 1, "id" FROM "ForumSection" WHERE "slug" = 'evropeyskie-avto';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-skoda-volvo', 'skoda-volvo', 'Skoda и Volvo', 'Octavia, Kodiaq, XC60, XC90', "groupKey", 2, "id" FROM "ForumSection" WHERE "slug" = 'evropeyskie-avto';

-- centralnyy-fo
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-moskva', 'moskva', 'Москва и область', 'Столичный регион', "groupKey", 1, "id" FROM "ForumSection" WHERE "slug" = 'centralnyy-fo';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-chernozemye', 'chernozemye', 'Черноземье', 'Воронеж, Липецк, Белгород, Курск', "groupKey", 2, "id" FROM "ForumSection" WHERE "slug" = 'centralnyy-fo';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-cfo-drugie', 'cfo-drugie', 'Другие города ЦФО', 'Рязань, Тверь, Ярославль, Тула, Калуга', "groupKey", 3, "id" FROM "ForumSection" WHERE "slug" = 'centralnyy-fo';

-- severo-zapadnyy-fo
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-piter', 'piter', 'Санкт-Петербург и область', 'Питер и Ленинградская область', "groupKey", 1, "id" FROM "ForumSection" WHERE "slug" = 'severo-zapadnyy-fo';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-szfo-drugie', 'szfo-drugie', 'Другие города СЗФО', 'Калининград, Карелия, Мурманск, Архангельск', "groupKey", 2, "id" FROM "ForumSection" WHERE "slug" = 'severo-zapadnyy-fo';

-- privolzhskiy-fo
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-tatarstan-bashkiriya', 'tatarstan-bashkiriya', 'Татарстан и Башкирия', 'Казань, Уфа, Набережные Челны', "groupKey", 1, "id" FROM "ForumSection" WHERE "slug" = 'privolzhskiy-fo';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-povolzhye', 'povolzhye', 'Поволжье', 'Самара, Саратов, Нижний Новгород, Ульяновск', "groupKey", 2, "id" FROM "ForumSection" WHERE "slug" = 'privolzhskiy-fo';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-pfo-drugie', 'pfo-drugie', 'Другие города ПФО', 'Пермь, Ижевск, Оренбург, Пенза, Киров', "groupKey", 3, "id" FROM "ForumSection" WHERE "slug" = 'privolzhskiy-fo';

-- yuzhnyy-fo
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-krasnodar', 'krasnodar', 'Краснодарский край', 'Краснодар, Сочи, Новороссийск', "groupKey", 1, "id" FROM "ForumSection" WHERE "slug" = 'yuzhnyy-fo';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-rostov-krym', 'rostov-krym', 'Ростов и Крым', 'Ростов-на-Дону, Симферополь, Севастополь', "groupKey", 2, "id" FROM "ForumSection" WHERE "slug" = 'yuzhnyy-fo';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-yufo-drugie', 'yufo-drugie', 'Другие города ЮФО', 'Волгоград, Астрахань, Адыгея, Калмыкия', "groupKey", 3, "id" FROM "ForumSection" WHERE "slug" = 'yuzhnyy-fo';

-- severo-kavkazskiy-fo
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-stavropol', 'stavropol', 'Ставропольский край', 'Ставрополь, Пятигорск, Кисловодск', "groupKey", 1, "id" FROM "ForumSection" WHERE "slug" = 'severo-kavkazskiy-fo';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-kavkaz-respubliki', 'kavkaz-respubliki', 'Республики Кавказа', 'Дагестан, Чечня, Осетия, Кабардино-Балкария', "groupKey", 2, "id" FROM "ForumSection" WHERE "slug" = 'severo-kavkazskiy-fo';

-- uralskiy-fo
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-ekaterinburg', 'ekaterinburg', 'Екатеринбург и область', 'Свердловская область', "groupKey", 1, "id" FROM "ForumSection" WHERE "slug" = 'uralskiy-fo';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-tyumen-hmao', 'tyumen-hmao', 'Тюмень, ХМАО и ЯНАО', 'Сургут, Нижневартовск, Новый Уренгой', "groupKey", 2, "id" FROM "ForumSection" WHERE "slug" = 'uralskiy-fo';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-chelyabinsk-kurgan', 'chelyabinsk-kurgan', 'Челябинск и Курган', 'Магнитогорск, Миасс, Курган', "groupKey", 3, "id" FROM "ForumSection" WHERE "slug" = 'uralskiy-fo';

-- sibirskiy-fo
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-novosibirsk-omsk', 'novosibirsk-omsk', 'Новосибирск и Омск', 'Новосибирская и Омская области', "groupKey", 1, "id" FROM "ForumSection" WHERE "slug" = 'sibirskiy-fo';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-krasnoyarsk-irkutsk', 'krasnoyarsk-irkutsk', 'Красноярск и Иркутск', 'Братск, Ангарск, Норильск', "groupKey", 2, "id" FROM "ForumSection" WHERE "slug" = 'sibirskiy-fo';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-sfo-drugie', 'sfo-drugie', 'Другие города СФО', 'Кемерово, Барнаул, Томск, Алтай, Хакасия', "groupKey", 3, "id" FROM "ForumSection" WHERE "slug" = 'sibirskiy-fo';

-- dalnevostochnyy-fo
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-vladivostok', 'vladivostok', 'Владивосток и Приморье', 'Уссурийск, Находка, Артём', "groupKey", 1, "id" FROM "ForumSection" WHERE "slug" = 'dalnevostochnyy-fo';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-habarovsk-amur', 'habarovsk-amur', 'Хабаровск и Приамурье', 'Комсомольск-на-Амуре, Благовещенск, Биробиджан', "groupKey", 2, "id" FROM "ForumSection" WHERE "slug" = 'dalnevostochnyy-fo';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-sahalin-kamchatka', 'sahalin-kamchatka', 'Сахалин, Камчатка, Якутия', 'Южно-Сахалинск, Петропавловск, Магадан', "groupKey", 3, "id" FROM "ForumSection" WHERE "slug" = 'dalnevostochnyy-fo';

-- zapchasti-i-remont
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-poisk-zapchastey', 'poisk-zapchastey', 'Поиск запчастей', 'Ищу деталь, аналоги, оригинал или заменитель', "groupKey", 1, "id" FROM "ForumSection" WHERE "slug" = 'zapchasti-i-remont';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-dvigatel-korobka', 'dvigatel-korobka', 'Двигатель и коробка', 'Ремонт ДВС, АКПП, вариатора, сцепления', "groupKey", 2, "id" FROM "ForumSection" WHERE "slug" = 'zapchasti-i-remont';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-hodovaya-tormoza', 'hodovaya-tormoza', 'Ходовая и тормоза', 'Подвеска, рулевое, тормозная система', "groupKey", 3, "id" FROM "ForumSection" WHERE "slug" = 'zapchasti-i-remont';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-elektrika-diagnostika', 'elektrika-diagnostika', 'Электрика и диагностика', 'Ошибки, проводка, мультимедиа, сканеры', "groupKey", 4, "id" FROM "ForumSection" WHERE "slug" = 'zapchasti-i-remont';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-kuzov-pokraska', 'kuzov-pokraska', 'Кузов и покраска', 'Ремонт кузова, антикор, покраска, стёкла', "groupKey", 5, "id" FROM "ForumSection" WHERE "slug" = 'zapchasti-i-remont';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-servisy-i-mastera', 'servisy-i-mastera', 'Сервисы и мастера', 'Кто где чинится, отзывы о сервисах', "groupKey", 6, "id" FROM "ForumSection" WHERE "slug" = 'zapchasti-i-remont';

-- vybor-avto
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-chto-vzyat', 'chto-vzyat', 'Что взять за свои деньги', 'Помогите определиться, сравнение вариантов', "groupKey", 1, "id" FROM "ForumSection" WHERE "slug" = 'vybor-avto';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-proverka-pered-pokupkoy', 'proverka-pered-pokupkoy', 'Проверка перед покупкой', 'Осмотр, диагностика, юридическая чистота', "groupKey", 2, "id" FROM "ForumSection" WHERE "slug" = 'vybor-avto';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-otzyvy-vladelcev', 'otzyvy-vladelcev', 'Отзывы владельцев', 'Реальный опыт эксплуатации', "groupKey", 3, "id" FROM "ForumSection" WHERE "slug" = 'vybor-avto';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-elektro-i-gibridy', 'elektro-i-gibridy', 'Электромобили и гибриды', 'Запас хода, зарядки, батареи зимой', "groupKey", 4, "id" FROM "ForumSection" WHERE "slug" = 'vybor-avto';

-- rastamozhka-i-import
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-yaponiya-koreya', 'yaponiya-koreya', 'Из Японии и Кореи', 'Аукционы, перегон, документы', "groupKey", 1, "id" FROM "ForumSection" WHERE "slug" = 'rastamozhka-i-import';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-kitay', 'kitay', 'Из Китая', 'Поставщики, сроки, гарантия', "groupKey", 2, "id" FROM "ForumSection" WHERE "slug" = 'rastamozhka-i-import';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-poshliny-i-utilsbor', 'poshliny-i-utilsbor', 'Пошлины и утильсбор', 'Расчёт платежей, изменения правил', "groupKey", 3, "id" FROM "ForumSection" WHERE "slug" = 'rastamozhka-i-import';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-sbkts-epts', 'sbkts-epts', 'СБКТС, ЭПТС и учёт', 'Оформление, лаборатории, постановка на учёт', "groupKey", 4, "id" FROM "ForumSection" WHERE "slug" = 'rastamozhka-i-import';

-- pdd-i-shtrafy
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-osago-kasko', 'osago-kasko', 'ОСАГО и КАСКО', 'Выплаты, отказы, споры со страховой', "groupKey", 1, "id" FROM "ForumSection" WHERE "slug" = 'pdd-i-shtrafy';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-shtrafy-gibdd', 'shtrafy-gibdd', 'Штрафы и ГИБДД', 'Обжалование, камеры, лишение прав', "groupKey", 2, "id" FROM "ForumSection" WHERE "slug" = 'pdd-i-shtrafy';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-dtp-razbor', 'dtp-razbor', 'Разбор ДТП', 'Кто виноват, европротокол, суды', "groupKey", 3, "id" FROM "ForumSection" WHERE "slug" = 'pdd-i-shtrafy';

-- tyuning
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-chip-i-vyhlop', 'chip-i-vyhlop', 'Чип-тюнинг и выхлоп', 'Прошивки, мощность, звук', "groupKey", 1, "id" FROM "ForumSection" WHERE "slug" = 'tyuning';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-podveska-i-stayling', 'podveska-i-stayling', 'Подвеска и стайлинг', 'Занижение, лифт, обвесы, плёнка', "groupKey", 2, "id" FROM "ForumSection" WHERE "slug" = 'tyuning';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-audio-v-avto', 'audio-v-avto', 'Аудио в автомобиле', 'Головные устройства, акустика, шумоизоляция', "groupKey", 3, "id" FROM "ForumSection" WHERE "slug" = 'tyuning';

-- shiny-i-diski
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-zima-leto', 'zima-leto', 'Зимняя и летняя резина', 'Что брать, шипы или липучка', "groupKey", 1, "id" FROM "ForumSection" WHERE "slug" = 'shiny-i-diski';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-razmery-i-diski', 'razmery-i-diski', 'Размеры и диски', 'Подбор, разболтовка, вылет', "groupKey", 2, "id" FROM "ForumSection" WHERE "slug" = 'shiny-i-diski';

-- kuplya-prodazha
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-opyt-sdelok', 'opyt-sdelok', 'Опыт сделок', 'Как прошло, на что смотреть', "groupKey", 1, "id" FROM "ForumSection" WHERE "slug" = 'kuplya-prodazha';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-torg-i-cena', 'torg-i-cena', 'Торг и цена', 'Сколько реально стоит, как торговаться', "groupKey", 2, "id" FROM "ForumSection" WHERE "slug" = 'kuplya-prodazha';

-- kurilka
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-puteshestviya', 'puteshestviya', 'Путешествия и перегон', 'Дальние поездки, маршруты, ночёвки', "groupKey", 1, "id" FROM "ForumSection" WHERE "slug" = 'kurilka';
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position", "parentId")
SELECT 'fs-garazh-i-byt', 'garazh-i-byt', 'Гараж и быт', 'Инструмент, гараж, разговоры за жизнь', "groupKey", 2, "id" FROM "ForumSection" WHERE "slug" = 'kurilka';
