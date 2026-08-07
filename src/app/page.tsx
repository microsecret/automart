import { VehicleHero } from '@/components/hero/vehicle-hero';
import { CategoriesSection } from '@/components/categories-section';
import { FeaturedListings } from '@/components/featured-listings';
import { AIservicesSection } from '@/components/ai-services-section';
import { TestimonialsSection } from '@/components/testimonials-section';

export default function HomePage() {
  return (
    <>
      <VehicleHero />
      <CategoriesSection />
      <FeaturedListings />
      <AIservicesSection />
      <TestimonialsSection />
    </>
  );
}