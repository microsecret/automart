import Image from 'next/image';
import { Quote, Star } from 'lucide-react';

export function TestimonialsSection() {
  const testimonials = [
    {
      id: '1',
      name: 'Алексей Петров',
      location: 'Москва',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80',
      rating: 5,
      comment: 'Продал свой BMW X5 за 2 дня благодаря AI-оценке цены. Получил на 15% больше рыночной стоимости!',
    },
    {
      id: '2',
      name: 'Мария Соколова',
      location: 'Санкт-Петербург',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80',
      rating: 5,
      comment: 'Нашла идеальную Yamaha R3 через умный подбор. Система показала варианты, которые я бы никогда не нашла сама.',
    },
    {
      id: '3',
      name: 'Дмитрий Кузнецов',
      location: 'Новосибирск',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&q=80',
      rating: 4,
      comment: 'Проверка VIN выявила скрученный пробег на рассматриваемом автомобиле. Сэкономил 300 тысяч рублей на плохой покупке.',
    },
  ];

  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="mb-12 text-3xl font-bold text-center">
          Что говорят наши пользователи
        </h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((testimonial) => (
            <div 
              key={testimonial.id} 
              className="relative overflow-hidden rounded-xl border border-border/200 
                         bg-white/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300"
            >
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <Image
                    src={testimonial.avatar}
                    alt={testimonial.name}
                    width={100}
                    height={100}
                    className="w-12 h-12 rounded-full border-2 border-primary"
                  />
                  <div className="ml-4">
                    <h3 className="font-semibold">{testimonial.name}</h3>
                    <p className="text-sm text-muted-foreground">{testimonial.location}</p>
                  </div>
                </div>
                
                <div className="flex items-center mb-3">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star 
                      key={star} 
                      className={`h-4 w-4 text-${testimonial.rating >= star ? 'yellow' : 'gray-300'}`}
                    />
                  ))}
                </div>
                
                <p className="text-muted-foreground line-clamp-4 italic">
                  &ldquo;{testimonial.comment.replace(/"/g, '&quot;')}&rdquo;
                </p>
                
                <div className="mt-4 text-xs text-primary">
                  <Quote className="h-3 w-3 mr-1" /> Проверенный покупатель
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
