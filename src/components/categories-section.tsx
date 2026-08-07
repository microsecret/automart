import Link from 'next/link';
import {
  Car,
  Truck,
  Bike,  // Correct icon for Motorcycle
  Sailboat,  // Correct icon for Boat
  Airplay,  // Correct icon for Aircraft
  Wrench,
  Users,
  Shield
} from 'lucide-react';

export function CategoriesSection() {
  const categories = [
    {
      id: 'cars',
      title: 'Легковые автомобили',
      description: 'Седаны, хэтчбеки, внедорожники, купе и кабриолеты',
      icon: Car,
      count: '12,450+',
    },
    {
      id: 'trucks',
      title: 'Грузовые автомобили',
      description: 'Фургоны, самосвалы, тягачи, автобусы и специальная техника',
      icon: Truck,
      count: '3,200+',
    },
    {
      id: 'motorcycles',
      title: 'Мотоциклы и мопеды',
      description: 'Спортивные, туристические, чопперы, скутеры и электромотоциклы',
      icon: Bike,  // Correct icon for Motorcycle
      count: '2,100+',
    },
    {
      id: 'boats',
      title: 'Водный транспорт',
      description: 'Лодки, катера, яхты, гидроциклы и сухогрузы',
      icon: Sailboat,  // Using Sailboat as placeholder
      count: '850+',
    },
    {
      id: 'aircraft',
      title: 'Авиация',
      description: 'Самолеты, вертолеты, планеры и беспилотные авиационные системы',
      icon: Airplay,
      count: '120+',
    },
    {
      id: 'parts',
      title: 'Автозапчасти',
      description: 'Двигатели, коробки передач, подвеска, электроника и кузовные детали',
      icon: Wrench,
      count: '45,000+',
    },
    {
      id: 'services',
      title: 'Услуги',
      description: 'Страхование, регистрация, технический осмотр, тюнинг и ремонт',
      icon: Users,
      count: '850+',
    },
    {
      id: 'ai-services',
      title: 'AI-Сервисы',
      description: 'Оценка стоимости, проверка истории, подбор аналогов и прогноз цен',
      icon: Shield,
      count: '5+',
    },
  ];

  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="mb-12 text-3xl font-bold text-center">
          Категории транспорта и услуг
        </h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((category) => (
            <div 
              key={category.id} 
              className="group relative overflow-hidden rounded-xl border border-border/200 
                         bg-white/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300"
            >
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <div className="bg-primary/10 rounded-full p-3">
                    <category.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="ml-4 text-lg font-semibold">
                    {category.title}
                  </h3>
                </div>
                <p className="mb-4 text-muted-foreground line-clamp-2">
                  {category.description}
                </p>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-900">
                    {category.count} объявлений
                  </span>
                  <Link href={`/${category.id}`} className="text-primary hover:text-primary/80 transition-colors">
                    Смотреть все →
                    <span className="ml-1">→</span>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
