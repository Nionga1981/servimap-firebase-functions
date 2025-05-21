import type {NextConfig} from 'next';

// Ensuring this configuration is up-to-date for the build process
const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.mexicanada.com.mx',
        port: '',
        pathname: '/images/**',
      }
    ],
  },
};

export default nextConfig;
