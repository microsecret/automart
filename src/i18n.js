import NextI18Next from 'next-i18next/dist/appRouter'
import nextI18NextConfig from '../next-i18next.config'

export const NextI18NextInstance = NextI18Next(nextI18nextConfig)

export const { appWithTranslation, useTranslation, Link, Router, changeLanguage, defaultLanguage } = NextI18NextInstance

export default NextI18NextInstance