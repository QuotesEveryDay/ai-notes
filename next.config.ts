/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  basePath: '/ai-notes', // set to your repo name
  trailingSlash: true,
};

export default nextConfig;
