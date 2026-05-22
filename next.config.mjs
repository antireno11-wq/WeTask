/** @type {import('next').NextConfig} */
const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
const allowedOrigins = appUrl
  ? [appUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")]
  : process.env.NODE_ENV === "production"
    ? []
    : ["localhost:3000"];

const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins
    }
  }
};

export default nextConfig;
