export function TrendingSearches() {
  const trending = [
    'Toyota Camry 2020',
    'BMW X5 2021',
    'Mercedes-Benz E-Class',
    'Honda Civic 2019',
    'Ford F-150 2022',
    'Hyundai Tucson',
    'Kia Sportage',
    'Volkswagen Passat',
  ];

  return (
    <div className="flex flex-wrap gap-2 justify-center mt-4">
      {trending.map((term, index) => (
        <span 
          key={index}
          className="px-3 py-1.5 bg-white/80 backdrop-blur-sm rounded-full text-sm 
                     hover:bg-white/90 hover:bg-opposite transition-all 
                     border border-border/50"
        >
          #{term}
        </span>
      ))}
    </div>
  );
}
