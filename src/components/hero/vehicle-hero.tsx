import Link from 'next/link';
import { SearchBar } from '@/components/forms/search-bar';

export function VehicleHero() {
  return (
    <section className="relative bg-gradient-to-br from-primary to-accent">
      <div className="relative isolate pt-20 pb-24 lg:pt-28 lg:pb-32">
        {/* Background Pattern */}
        <div className="absolute inset-0 -z-10" aria-hidden="true">
          <div className="absolute inset-0 bg-[radial-gradient ellipse_at_top_variant(transparent,var(--background))]"></div>
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22><path d=%22M30 0a30 30 0 1 0 0 60 30 30 0 0 0 0-60zm0 50a20 20 0 1 1 0-40 20 20 0 0 1 0 40zm24-30a4 4 0 1 0-8 0 4 4 0 0 0 8 0zm-16 0a4 4 0 1 0-8 0 4 4 0 0 0 8 0zZM0 30a30 30 0 1 1 60 0 30 30 0 0 1-60 0Z%22 fill=%22currentColor%22/%20</path></svg>') bg-[opacity:0.05]"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="mt-6 text-5xl font-bold text-white lg:text-6xl">
              Комплексная площадка<br />
              <span className="block lg:inline">для покупки и продажи транспорта</span>
            </h1>
            <p className="mt-6 text-lg text-white/90 max-w-xl">
              Найдите идеальный автомобиль, мотоцикл, лодку или самолет.
              Продавайте свой транспорт быстро и выгодно с нашими AI-сервисами.
            </p>
            <div className="mt-8">
              <SearchBar />
            </div>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4 text-sm text-white/80">
              <span>Более 100 000 активных объявлений</span>
              <span className="mx-2">•</span>
              <span>Автомобили, мотоциклы, водный транспорт, авиация</span>
              <span className="mx-2">•</span>
              <span>Запчасти и комплектующие</span>
              <span className="mx-2">•</span>
              <span>AI-оценка стоимости и проверка истории</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}