/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ["wetask.cl", "www.wetask.cl", "*.wetask.cl", "*.railway.app"]
    }
  }
};

export default nextConfig;
