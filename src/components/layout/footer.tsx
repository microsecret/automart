import Link from 'next/link';
import { Users, Shield, MapPin, Phone, Mail } from 'lucide-react';
import { FaGithub, FaLinkedin, FaTwitter } from 'react-icons/fa';

export function Footer() {
  return (
    <footer className="border-t border-border/200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <h3 className="mb-4 text-lg font-semibold">
              <span className="gradient-text text-xl">AutoRent</span>
              <span className="text-primary">Markt</span>
            </h3>
            <p className="text-muted-foreground">
              Comprehensive auto marketplace platform with AI-powered services.
              Buy and sell vehicles, parts, and more with confidence.
            </p>
            <div className="mt-4 flex space-x-4">
              <a href="#" className="hover:text-primary transition-colors">
                <FaGithub className="h-5 w-5" />
              </a>
              <a href="#" className="hover:text-primary transition-colors">
                <FaLinkedin className="h-5 w-5" />
              </a>
              <a href="#" className="hover:text-primary transition-colors">
                <FaTwitter className="h-5 w-5" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="mb-4 text-lg font-semibold">Разделы</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/listings" className="text-muted-foreground hover:text-primary transition-colors">
                  Транспорт
                </Link>
              </li>
              <li>
                <Link href="/parts" className="text-muted-foreground hover:text-primary transition-colors">
                  Запчасти
                </Link>
              </li>
              <li>
                <Link href="/services" className="text-muted-foreground hover:text-primary transition-colors">
                  Услуги
                </Link>
              </li>
              <li>
                <Link href="/ai-services" className="text-muted-foreground hover:text-primary transition-colors">
                  AI-Сервисы
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-lg font-semibold">Компания</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/about" className="text-muted-foreground hover:text-primary transition-colors">
                  О нас
                </Link>
              </li>
              <li>
                <Link href="/blog" className="text-muted-foreground hover:text-primary transition-colors">
                  Блог
                </Link>
              </li>
              <li>
                <Link href="/contacts" className="text-muted-foreground hover:text-primary transition-colors">
                  Контакты
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-muted-foreground hover:text-primary transition-colors">
                  Политика конфиденциальности
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-muted-foreground hover:text-primary transition-colors">
                  Условия использования
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-lg font-semibold">Контакты</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center">
                <MapPin className="h-4 w-4 mr-2" />
                <span>Москва, Россия</span>
              </div>
              <div className="flex items-center">
                <Phone className="h-4 w-4 mr-2" />
                <span>+7 (495) 123-45-67</span>
              </div>
              <div className="flex items-center">
                <Mail className="h-4 w-4 mr-2" />
                <span>info@autorentmarkt.ru</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border/200">
          <p className="text-center text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} AutoRent Markt. Все права защищены.
          </p>
        </div>
      </div>
    </footer>
  );
}