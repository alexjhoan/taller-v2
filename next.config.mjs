import os from "node:os";

// IPs LAN (IPv4 no-internas) detectadas en runtime.
const lanAddresses = Object.values(os.networkInterfaces())
  .flat()
  .filter((iface) => iface && iface.family === "IPv4" && !iface.internal)
  .map((iface) => iface.address);

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  reactStrictMode: false,
  swcMinify: true,
  // assetPrefix: `/v${process.env.NEXT_PUBLIC_VERSION}/`, // se debe crear crear la carpeta con la version y meter alli la carpeta _next
  // cacheMaxMemorySize: 0, // disable default in-memory caching
  // generateBuildId: async () => {
  //   return `v${process.env.NEXT_PUBLIC_VERSION}`
  // },
  images: {
    unoptimized: true,
  },
  // Permite acceder al dev server (assets /_next/* y HMR) desde:
  // - localhost
  // - IPs LAN detectadas (ej. 192.168.x.x, 10.x.x.x)
  // - Tu túnel de devtunnels.ms (hostname EXACTO, no wildcard en segmento medio)
  allowedDevOrigins: [
    "localhost",
    ...lanAddresses,
    "88sprv73-3000.use2.devtunnels.ms",
    // Si cambias de túnel, agrega el nuevo hostname aquí
  ],
};

export default nextConfig;
