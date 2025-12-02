/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configuração vazia para Turbopack - resolve conflito com webpack
  turbopack: {},
  experimental: {
    optimizePackageImports: ['lucide-react', '@heroicons/react']
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      }
    ]
  }
};

module.exports = nextConfig;