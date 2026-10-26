/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // What's new reads its content and screenshots from disk at request time.
  outputFileTracingIncludes: {
    '/api/whats-new': ['./whats-new/content.json'],
    '/api/whats-new/shot': ['./whats-new/shots/**/*'],
  },
};

export default nextConfig;
