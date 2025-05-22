import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    allowedDevOrigins: [
      'https://9000-firebase-studio-1747377755837.cluster-aj77uug3sjd4iut4ev6a4jbtf2.cloudworkstations.dev'
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.mexicanada.com.mx',
        port: '',
        pathname: '/images/**',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**', // Allows all paths from placehold.co
      },
    ],
  },
}

export default nextConfig
