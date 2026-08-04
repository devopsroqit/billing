/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Allow document uploads up to ~12 MB via Server Actions (Next defaults to
    // 1 MB). The upload handler itself still caps individual files at 10 MB.
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
