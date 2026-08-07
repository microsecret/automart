module.exports = {
  i18n: {
    defaultLocale: 'ru',
    locales: ['ru', 'en'],
  },
  localePath: typeof window === 'undefined' ? './public/locales' : '/public/locales',
};
