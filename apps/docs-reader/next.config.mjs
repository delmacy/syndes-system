/** The same Next.js application can run normally or export to GitHub Pages. */
const readerBase = process.env.NEXT_PUBLIC_READER_BASEPATH || "";
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  trailingSlash: true,
  ...(readerBase ? { output: "export", basePath: readerBase } : {}),
};
export default nextConfig;
