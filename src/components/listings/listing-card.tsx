'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Eye, MapPin, Calendar, Fuel, Wrench, Car, Truck, Bike, Sailboat, Airplay, Package, Heart } from 'lucide-react';
import { useState } from 'react';

interface ListingCardProps {
  listing: {
    id: string;
    title: string;
    price: number;
    image: string;
    location: string;
    year: number;
    mileage: number;
    type: 'car' | 'truck' | 'motorcycle' | 'boat' | 'aircraft' | 'part';
    isFeatured?: boolean;
  };
  className?: string;
}

export function ListingCard({
  listing,
  className = ''
}: ListingCardProps) {
  const [isFavorited, setIsFavorited] = useState(false);
  const [isToggleLoading, setIsToggleLoading] = useState(false);

  const toggleFavorite = async () => {
    setIsToggleLoading(true);
    try {
      // In a real app, we would make an API call to toggle the favorite status
      // For now, we'll just toggle the local state
      setIsFavorited(!isFavorited);

      // TODO: Implement actual API call to /api/favorites
    } catch (err) {
      console.error("Error toggling favorite:", err);
    } finally {
      setIsToggleLoading(false);
    }
  };

  // Check if listing is favorited by current user
  // This would ideally be passed as a prop or fetched from context
  // For now, we'll show the heart outline and let users toggle it
  // In a real implementation, you would check against the user's favorites
  const formatPrice = (price: number) => {
    return price.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' });
  };

  const formatMileage = (mileage: number) => {
    return mileage.toLocaleString('ru-RU') + ' км';
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'car': return <Car className="h-3 w-3 mr-1" />;
      case 'truck': return <Truck className="h-3 w-3 mr-1" />;
      case 'motorcycle': return <Bike className="h-3 w-3 mr-1" />;
      case 'boat': return <Sailboat className="h-3 w-3 mr-1" />;
      case 'aircraft': return <Airplay className="h-3 w-3 mr-1" />;
      case 'part': return <Package className="h-3 w-3 mr-1" />;
      default: return <Car className="h-3 w-3 mr-1" />;
    }
  };

  return (
    <Link
      href={`/listings/${listing.id}`}
      className={`group relative overflow-hidden rounded-xl border border-border/50
                  bg-white/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300
                  ${className}`}
    >
      {/* Featured badge */}
      {listing.isFeatured && (
        <div className="absolute top-3 left-3 bg-primary/90 text-white text-xs px-2 py-1 rounded-full">
          Рекомендуем
        </div>
      )}

      {/* Image */}
      <div className="aspect-video w-full">
        <Image
          src={listing.image}
          alt={listing.title}
          fill
          className="object-cover w-full h-full"
        />
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-transparent to-black/40
                     opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="absolute bottom-4 left-4 flex space-x-3 text-white text-sm">
            <div className="flex items-center">
              <Eye className="h-4 w-4 mr-1" />
              1.2K
            </div>
            <div className="flex items-center">
              <MapPin className="h-4 w-4 mr-1" />
              {listing.location}
            </div>
            <div className="flex items-center">
              <button
                onClick={toggleFavorite}
                disabled={isToggleLoading}
                className={`p-1 rounded ${isFavorited ? 'bg-red-500' : 'bg-white/20'} hover:bg-white/30 transition-colors`}
              >
                {isFavorited ? (
                  <Heart className="h-4 w-4 text-white" />
                ) : (
                  <Heart className="h-4 w-4 text-white/80" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-4 pb-6">
        <h3 className="mb-2 line-clamp-2 font-semibold text-gray-900">
          {listing.title}
        </h3>
        <p className="mb-4 text-xl font-bold text-primary">
          {formatPrice(listing.price)}
        </p>

        <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground">
          <div>
            <div className="flex items-center">
              <Calendar className="h-3 w-3 mr-1" />
              <span>{listing.year}</span>
            </div>
          </div>
          <div>
            <div className="flex items-center">
              <Fuel className="h-3 w-3 mr-1" />
              <span>{formatMileage(listing.mileage)}</span>
            </div>
          </div>
          <div className="col-span-2">
            <div className="flex items-center">
              <Wrench className="h-3 w-3 mr-1" />
              <span>{getTypeIcon(listing.type)} {listing.type}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}