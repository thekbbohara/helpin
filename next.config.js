/** @type {import('next').NextConfig} */
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
      : undefined;

const nextConfig = {
      reactStrictMode: true,
      images: {
            remotePatterns: supabaseHost
                  ? [{ protocol: 'https', hostname: supabaseHost }]
                  : [],
      },
};

module.exports = nextConfig;
