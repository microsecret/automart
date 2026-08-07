import { Wrench, Search } from 'lucide-react';
import Link from 'next/link';

export function CTASection() {
  return (
    <section className="relative bg-gradient-to-b from-primary/90 to-secondary/20 py-16">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1558981403-c5f9896a35eb?auto=format&fit=crop&w=1920&q=80')]
                    bg-cover bg-center opacity-20"></div>
      </div>
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="mb-6 text-3xl font-bold text-white shadow-lg">
          Готовы найти свой идеальный транспорт?
        </h2>
        <p className="mb-8 text-xl text-white/90 max-w-2xl mx-auto">
          Разместите объявление бесплатно или найдите то, что ищете с нашими AI-сервисами
        </p>
        <div className="flex flex-col sm:flex-row sm:justify-center gap-4">
          <Link
            href="/create-listing"
            className="flex-1 bg-gradient-to-r from-primary to-accent hover:from-accent hover:to-primary
                       text-white font-semibold py-4 px-6 rounded-lg hover:shadow-lg transition-all
                       flex items-center justify-center space-x-2 text-lg"
          >
            <Wrench className="h-4 w-4" />
            Разместить объявление
          </Link>
          <Link
            href="/vehicles"
            className="flex-1 border border-white/30 bg-white/20 hover:bg-white/30
                       text-white font-semibold py-4 px-6 rounded-lg hover:shadow-lg transition-all
                       flex items-center justify-center space-x-2 text-lg"
          >
            <Search className="h-4 w-4" />
            Найти транспорт
          </Link>
        </div>
        <p className="mt-6 text-xs text-white/70">
          Уже 150,000+ пользователей доверяют AutoRent Markt
        </p>
      </div>
    </section>
  );
}
