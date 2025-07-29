import withPWA from 'next-pwa';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: 'export', // Disabled for standard Next.js deployment
  // trailingSlash: true,
  images: {
    unoptimized: true,
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
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**', // Allows all paths from images.unsplash.com
      },
    ],
  },
  reactStrictMode: true,
  swcMinify: true,
  webpack: (config, { isServer, dev, webpack }) => {
    // Fix for undici/Firebase compatibility issues
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: 'crypto-browserify',
        stream: 'stream-browserify',
        buffer: 'buffer',
        util: 'util',
        url: 'url',
        assert: 'assert',
      };
      
      // Add polyfills
      config.plugins.push(
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
          process: 'process/browser',
        })
      );
    }

    // Ignore undici in client-side builds
    config.resolve.alias = {
      ...config.resolve.alias,
      'undici': false,
    };

    return config;
  },
  experimental: {
    esmExternals: 'loose',
  },
}

export default withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  buildExcludes: [/middleware-manifest.json$/],
})(nextConfig);
