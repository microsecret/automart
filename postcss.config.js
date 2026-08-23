/* Рядом лежит postcss.config.mjs с обработчиком Mantine.

   Какой из двух читает Next, зависит от его версии. Возможности
   postcss-preset-mantine — light-dark(), rem(), переменные брейкпоинтов —
   в проекте не используются, поэтому разница между файлами ни на что не
   влияет. Оба оставлены намеренно: удаление одного сменило бы набор
   обработчиков в зависимости от версии сборщика. */
module.exports = {
  plugins: {
    autoprefixer: {},
    // Uncomment the following line to enable nested CSS
    // 'postcss-nesting': {}
  }
}