'use client';

import { useState } from 'react';
import { Search, Filter, MapPin, Car, Truck, Bike, Sailboat, Airplay, Wrench } from 'lucide-react';

export function SearchBar() {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [location, setLocation] = useState('');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);

  const categories = [
    { id: 'all', label: 'Все категории', icon: Search },
    { id: 'cars', label: 'Легковые', icon: Car },
    { id: 'trucks', label: 'Грузовые', icon: Truck },
    { id: 'motorcycles', label: 'Мотоциклы', icon: Bike },
    { id: 'boats', label: 'Водный транспорт', icon: Sailboat },
    { id: 'aircraft', label: 'Авиация', icon: Airplay },
    { id: 'parts', label: 'Запчасти', icon: Wrench },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement search functionality
    console.log('Searching:', { query, selectedCategory, location });
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-xl mx-auto space-y-4">
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center text-muted-foreground">
          <Search className="h-4 w-4" />
        </div>
        <input
          type="text"
          placeholder="Поиск по марке, модели, VIN..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 bg-white/90 backdrop-blur-sm
                     focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all
                     text-lg"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <div className="relative">
          <div className="absolute left-2 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center text-muted-foreground">
            <MapPin className="h-3 w-3" />
          </div>
          <input
            type="text"
            placeholder="Город, регион"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full pl-8 pr-4 py-3 rounded-lg border border-gray-300 bg-white/90 backdrop-blur-sm
                       focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all"
          />
        </div>

        <div className="relative">
          <button
            onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
            className="w-full flex items-center justify-between pl-8 pr-4 py-3 rounded-lg border border-gray-300
                       bg-white/90 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-primary
                       focus:ring-offset-2 transition-all text-left"
          >
            <div className="flex items-center space-x-2">
              <div className="flex h-4 w-4 items-center justify-center text-muted-foreground">
                <Filter className="h-3 w-3" />
              </div>
              <span>{selectedCategory === 'all' ? 'Все категории' : categories.find(c => c.id === selectedCategory)?.label}</span>
            </div>
            <svg className={`h-3 w-3 text-muted-foreground transition-transform duration-200 ${isCategoryDropdownOpen ? 'rotate-180' : ''}`}
                 xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2}
                 stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Category Dropdown Menu */}
          {isCategoryDropdownOpen && (
            <div className="absolute left-0 mt-2 w-56 bg-white/90 backdrop-blur-sm rounded-xl border border-border/200 shadow-lg z-20">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => {
                    setSelectedCategory(category.id);
                    setIsCategoryDropdownOpen(false);
                  }}
                  className={`w-full flex items-center px-4 py-2 text-left text-sm hover:bg-gray-100 transition-colors ${selectedCategory === category.id ? 'bg-primary/10' : ''}`}
                >
                  <div className="flex h-4 w-4 items-center justify-center text-muted-foreground mr-3">
                    <category.icon className="h-3 w-3" />
                  </div>
                  <span>{category.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <button
        type="submit"
        className="w-full bg-gradient-to-r from-primary to-accent hover:from-accent hover:to-primary
                   text-white font-semibold py-3 px-6 rounded-lg hover:shadow-lg transition-all
                   flex items-center justify-center space-x-2 text-lg"
      >
        <Search className="h-4 w-4" />
        Найти транспорт
      </button>
    </form>
  );
}
