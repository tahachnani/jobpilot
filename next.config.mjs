/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@react-pdf/renderer"],

    serverActions: {
      bodySizeLimit: "6mb",

      allowedOrigins: [
        "localhost:3000",
        "psychic-computing-machine-jrjvj6jv46vfp5wj-3000.app.github.dev",
      ],
    },
  },
};

export default nextConfig;