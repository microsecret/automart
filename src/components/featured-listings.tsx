import { ListingCard } from '@/components/listings/listing-card';

export function FeaturedListings() {
  // Mock data - in real app this would come from API
  const featuredListings = [
    {
      id: '1',
      title: 'Toyota Camry 2020',
      price: 1850000,
      image: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=400&q=80',
      location: 'Москва',
      year: 2020,
      mileage: 45000,
      type: 'car' as const,
      isFeatured: true,
    },
    {
      id: '2',
      title: 'BMW X5 2021',
      price: 4200000,
      image: 'https://images.unsplash.com/photo-1555215695-300a980d8389?auto=format&fit=crop&w=400&q=80',
      location: 'Санкт-Петербург',
      year: 2021,
      mileage: 25000,
      type: 'car' as const,
      isFeatured: true,
    },
    {
      id: '3',
      title: 'Yamaha YZF-R1 2022',
      price: 950000,
      image: 'https://images.unsplash.com/photo-1582719478250-59692d7601va?auto=format&fit=crop&w=400&q=80',
      location: 'Казань',
      year: 2022,
      mileage: 5000,
      type: 'motorcycle' as const,
      isFeatured: true,
    },
    {
      id: '4',
      title: 'Mercedes Actros 2021',
      price: 6800000,
      image: 'https://images.unsplash.com/photo-1581091908458-6c8d78040d3f?auto=format&fit=crop&w=400&q=80',
      location: 'Новосибирск',
      year: 2021,
      mileage: 120000,
      type: 'truck' as const,
      isFeatured: true,
    },
  ];

  return (
    <section className="py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="mb-8 text-3xl font-bold text-center">
          Избранные объявления
        </h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuredListings.map((listing) => (
            <ListingCard 
              key={listing.id} 
              listing={listing} 
              className="card-hover"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
