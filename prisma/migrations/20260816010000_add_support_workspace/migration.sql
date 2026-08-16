-- Dedicated support tickets for registered users and anonymous visitors.
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicTokenHash" TEXT NOT NULL,
    "userId" TEXT,
    "guestName" TEXT,
    "guestEmail" TEXT,
    "guestPhone" TEXT,
    "subject" TEXT NOT NULL DEFAULT 'Общий вопрос',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "mode" TEXT NOT NULL DEFAULT 'AI',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "assignedToId" TEXT,
    "lastMessageAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReadByStaffAt" DATETIME,
    "lastReadByVisitorAt" DATETIME,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SupportTicket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "authorType" TEXT NOT NULL,
    "authorUserId" TEXT,
    "content" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SupportMessage_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "SupportKnowledgeArticle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "keywords" TEXT NOT NULL,
    "link" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "SupportTicket_publicTokenHash_key" ON "SupportTicket"("publicTokenHash");
CREATE INDEX "SupportTicket_status_lastMessageAt_idx" ON "SupportTicket"("status", "lastMessageAt");
CREATE INDEX "SupportTicket_mode_status_lastMessageAt_idx" ON "SupportTicket"("mode", "status", "lastMessageAt");
CREATE INDEX "SupportTicket_userId_status_lastMessageAt_idx" ON "SupportTicket"("userId", "status", "lastMessageAt");
CREATE INDEX "SupportTicket_assignedToId_status_lastMessageAt_idx" ON "SupportTicket"("assignedToId", "status", "lastMessageAt");
CREATE INDEX "SupportMessage_ticketId_createdAt_idx" ON "SupportMessage"("ticketId", "createdAt");
CREATE INDEX "SupportMessage_authorUserId_createdAt_idx" ON "SupportMessage"("authorUserId", "createdAt");
CREATE UNIQUE INDEX "SupportKnowledgeArticle_slug_key" ON "SupportKnowledgeArticle"("slug");
CREATE INDEX "SupportKnowledgeArticle_isPublished_sortOrder_idx" ON "SupportKnowledgeArticle"("isPublished", "sortOrder");

-- Production knowledge base: factual navigation instructions, not demo data.
INSERT INTO "SupportKnowledgeArticle" ("id", "slug", "title", "summary", "content", "keywords", "link", "sortOrder", "updatedAt") VALUES
('kb-registration-web', 'registration-web', 'Регистрация на сайте', 'Как создать аккаунт через веб-версию.', '1) Нажмите «Регистрация» в верхней части сайта. 2) Укажите имя, действующий email и пароль. 3) Примите условия и отправьте форму. 4) После входа откройте «Личный кабинет» — там появятся объявления, сообщения и доставки.', 'регистрация зарегистрироваться аккаунт сайт email пароль войти вход', '/auth/signup', 10, CURRENT_TIMESTAMP),
('kb-registration-telegram', 'registration-telegram', 'Вход и регистрация через Telegram', 'Как связать Telegram и аккаунт LeWheel.', '1) Откройте раздел входа через Telegram. 2) Запустите официального бота LeWheel. 3) Отправьте контакт кнопкой Telegram — номер нельзя вводить за другого пользователя. 4) Получите одноразовый код и подтвердите вход на сайте. Никому не пересылайте код.', 'telegram телеграм бот контакт телефон код войти регистрация mini app мини приложение', '/auth/telegram', 20, CURRENT_TIMESTAMP),
('kb-create-listing', 'create-listing', 'Как подать объявление', 'Пошаговая публикация транспорта или запчасти.', '1) Войдите в аккаунт. 2) Нажмите «Подать объявление». 3) Выберите транспорт или запчасть. 4) Заполните обязательные характеристики и добавьте качественные фотографии. 5) Отправьте объявление на модерацию. Статус и замечания отображаются в личном кабинете.', 'объявление подать продать автомобиль авто транспорт запчасть модерация фото', '/listings/create/vehicle', 30, CURRENT_TIMESTAMP),
('kb-auctions', 'international-auctions', 'Автомобили из-за рубежа', 'Как пользоваться каталогом международных площадок.', 'Откройте «Аукционы», выберите страну, площадку и параметры автомобиля. Цена «под ключ» является предварительной: курс, пошлины и логистика должны быть подтверждены менеджером перед заказом. В карточке доступна ссылка на исходное объявление.', 'аукцион корея китай япония encar доставка растаможка пошлина цена под ключ', '/auctions', 40, CURRENT_TIMESTAMP),
('kb-password', 'password-recovery', 'Восстановление доступа', 'Что делать, если пароль забыт.', 'На странице входа нажмите «Забыли пароль?», укажите email аккаунта и следуйте инструкции. Не сообщайте пароль, код Telegram или ссылку восстановления посторонним.', 'забыл пароль восстановить доступ не могу войти код', '/auth/forgot-password', 50, CURRENT_TIMESTAMP),
('kb-promotion', 'listing-promotion', 'Продвижение объявления', 'Как работают платные тарифы.', 'Продвижение подключается только у активного объявления в личном кабинете. Подтверждённая оплата отображается во вкладке «Оплаты». Продвижение повышает видимость, но не гарантирует продажу. Если платёжный провайдер не настроен, списание не выполняется.', 'продвижение топ премиум vip оплата тариф объявление деньги', '/dashboard?tab=payments', 60, CURRENT_TIMESTAMP),
('kb-delivery', 'delivery-workspace', 'Доставка и документы', 'Где отслеживать этапы доставки.', 'Авторизованный пользователь видит заказы в разделе «Мои доставки». Там находятся этапы, сообщения, счета и закрытые документы. Не переводите деньги по реквизитам из сообщений вне подтверждённого рабочего пространства сделки.', 'доставка документы счет платёж заказ этапы транспортировка', '/dashboard/deliveries', 70, CURRENT_TIMESTAMP),
('kb-security', 'account-security', 'Безопасность аккаунта и сделки', 'Базовые правила защиты пользователя.', 'Проверяйте адрес lewheel.ru, не передавайте коды входа и не устанавливайте программы по просьбе продавца. Общайтесь через сайт, сверяйте VIN и документы, а о подозрительном объявлении сообщайте через кнопку жалобы или поддержку.', 'мошенник безопасность жалоба код вин документы подозрительно обман', '/help/safety', 80, CURRENT_TIMESTAMP);
