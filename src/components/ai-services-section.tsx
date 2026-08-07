import { Bot, Sparkles, Brain, Shield, BarChart, Wand } from 'lucide-react';

export function AIservicesSection() {
  const aiServices = [
    {
      id: 'valuation',
      title: 'AI-оценка стоимости',
      description: 'Точная рыночная оценка транспортного средства на основе тысяч параметров',
      icon: Bot,
      benefit: 'Узнайте реальную стоимость вашего транспорта за 30 секунд',
    },
    {
      id: 'history-check',
      title: 'Проверка истории по VIN',
      description: 'Полная история обслуживания,事故и, владельцев и ограничений',
      icon: Shield,
      benefit: 'Избегайте покупки транспортного средства с скрытыми проблемами',
    },
    {
      id: 'similar-search',
      title: 'Подбор аналогичных объявлений',
      description: 'Находим похожие варианты с лучшими условиями и ценами',
      icon: Sparkles,
      benefit: 'Сэкономьте время на поиске - мы найдем лучшие предложения',
    },
    {
      id: 'price-prediction',
      title: 'Прогноз изменения цен',
      description: 'AI-модельpredictирует как изменится цена на транспорт в ближайшие месяцы',
      icon: BarChart,
      benefit: 'Примите правильное решение о времени покупки или продажи',
    },
    {
      id: 'damage-assessment',
      title: 'Оценка повреждений по фото',
      description: 'Загрузите фото повреждений и получите экспертную оценку ремонта',
      icon: Wand,
      benefit: 'Определите стоимость ремонта до посещения сервиса',
    },
    {
      id: 'smart-matching',
      title: 'Умный подбор под ваши критерии',
      description: 'Система учится на ваших предпочтениях и предлагает идеальные варианты',
      icon: Brain,
      benefit: 'Получайте персонализированные рекомендации каждый день',
    },
  ];

  return (
    <section className="py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="mb-12 text-3xl font-bold text-center">
          Уникальные AI-Сервисы
        </h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {aiServices.map((service) => (
            <div 
              key={service.id} 
              className="group relative overflow-hidden rounded-xl border border-border/200 
                         bg-white/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300"
            >
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <div className="bg-primary/10 rounded-full p-4">
                    <service.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="ml-4 text-lg font-semibold">
                    {service.title}
                  </h3>
                </div>
                <p className="mb-4 text-muted-foreground line-clamp-3">
                  {service.description}
                </p>
                <div className="mt-4 flex items-center justify-between text-sm text-primary">
                  <span className="font-medium">{service.benefit}</span>
                  <span>→</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
