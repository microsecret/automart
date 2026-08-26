-- Форум автолюбителей.
--
-- Каталог отвечает только тем, кто уже собрался покупать. Форум приводит
-- людей раньше: человек ищет «как растаможить машину из Кореи» и попадает
-- на площадку задолго до того, как соберётся за машиной.

CREATE TABLE "ForumSection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "groupKey" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "topicCount" INTEGER NOT NULL DEFAULT 0,
    "postCount" INTEGER NOT NULL DEFAULT 0,
    "lastPostAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "ForumTopic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "views" INTEGER NOT NULL DEFAULT 0,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "lastPostAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "ForumTopic_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ForumSection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ForumTopic_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ForumPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topicId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "ForumPost_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "ForumTopic" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ForumPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ForumSection_slug_key" ON "ForumSection"("slug");
CREATE INDEX "ForumSection_groupKey_position_idx" ON "ForumSection"("groupKey", "position");
CREATE UNIQUE INDEX "ForumTopic_slug_key" ON "ForumTopic"("slug");
CREATE INDEX "ForumTopic_sectionId_isPinned_lastPostAt_idx" ON "ForumTopic"("sectionId", "isPinned", "lastPostAt");
CREATE INDEX "ForumTopic_authorId_idx" ON "ForumTopic"("authorId");
CREATE INDEX "ForumTopic_deletedAt_idx" ON "ForumTopic"("deletedAt");
CREATE INDEX "ForumPost_topicId_createdAt_idx" ON "ForumPost"("topicId", "createdAt");
CREATE INDEX "ForumPost_authorId_idx" ON "ForumPost"("authorId");

-- Разделы заводятся сразу: пустой форум без структуры не даёт человеку
-- понять, о чём здесь говорят, и он уходит.
INSERT INTO "ForumSection" ("id", "slug", "title", "description", "groupKey", "position") VALUES
  ('fs-region-cfo',  'centralnyy-fo',    'Центральный федеральный округ', 'Москва, Подмосковье, Черноземье', 'REGION', 1),
  ('fs-region-szfo', 'severo-zapadnyy-fo','Северо-Западный округ',        'Петербург, Карелия, Калининград', 'REGION', 2),
  ('fs-region-pfo',  'privolzhskiy-fo',  'Приволжский округ',             'Татарстан, Поволжье, Урал-предгорье', 'REGION', 3),
  ('fs-region-yufo', 'yuzhnyy-fo',       'Южный округ',                   'Краснодар, Ростов, Крым', 'REGION', 4),
  ('fs-region-skfo', 'severo-kavkazskiy-fo','Северо-Кавказский округ',    'Ставрополь, республики Кавказа', 'REGION', 5),
  ('fs-region-ufo',  'uralskiy-fo',      'Уральский округ',               'Екатеринбург, Тюмень, Челябинск', 'REGION', 6),
  ('fs-region-sfo',  'sibirskiy-fo',     'Сибирский округ',               'Новосибирск, Красноярск, Иркутск', 'REGION', 7),
  ('fs-region-dfo',  'dalnevostochnyy-fo','Дальневосточный округ',        'Владивосток, Хабаровск, Сахалин', 'REGION', 8),

  ('fs-origin-jp',   'yaponskie-avto',   'Японские автомобили',           'Toyota, Honda, Nissan, Mazda, Subaru', 'ORIGIN', 1),
  ('fs-origin-de',   'nemeckie-avto',    'Немецкие автомобили',           'Volkswagen, BMW, Mercedes-Benz, Audi', 'ORIGIN', 2),
  ('fs-origin-kr',   'koreyskie-avto',   'Корейские автомобили',          'Hyundai, Kia, Genesis, SsangYong', 'ORIGIN', 3),
  ('fs-origin-cn',   'kitayskie-avto',   'Китайские автомобили',          'Chery, Haval, Geely, Changan, Exeed', 'ORIGIN', 4),
  ('fs-origin-us',   'amerikanskie-avto','Американские автомобили',       'Ford, Chevrolet, Jeep, Tesla', 'ORIGIN', 5),
  ('fs-origin-ru',   'otechestvennye-avto','Отечественные автомобили',    'LADA, УАЗ, ГАЗ, Москвич', 'ORIGIN', 6),
  ('fs-origin-eu',   'evropeyskie-avto', 'Европейские прочие',            'Renault, Peugeot, Škoda, Volvo', 'ORIGIN', 7),

  ('fs-topic-parts', 'zapchasti-i-remont','Запчасти и ремонт',            'Поиск деталей, ремонт своими руками, сервисы', 'TOPIC', 1),
  ('fs-topic-choice','vybor-avto',       'Выбор автомобиля',              'Что взять, сравнения, отзывы владельцев', 'TOPIC', 2),
  ('fs-topic-import','rastamozhka-i-import','Растаможка и импорт',        'Пошлины, СБКТС, ЭПТС, доставка из-за рубежа', 'TOPIC', 3),
  ('fs-topic-law',   'pdd-i-shtrafy',    'ПДД, страховка и штрафы',       'ОСАГО, КАСКО, ГИБДД, разбор ситуаций', 'TOPIC', 4),
  ('fs-topic-tuning','tyuning',          'Тюнинг и доработки',            'Стайлинг, чип, подвеска, аудио', 'TOPIC', 5),
  ('fs-topic-wheels','shiny-i-diski',    'Шины и диски',                  'Сезонная резина, размеры, хранение', 'TOPIC', 6),
  ('fs-topic-deal',  'kuplya-prodazha',  'Купля-продажа',                 'Опыт сделок, торг, проверка перед покупкой', 'TOPIC', 7),
  ('fs-topic-talk',  'kurilka',          'Курилка',                       'Свободное общение автолюбителей', 'TOPIC', 8);
