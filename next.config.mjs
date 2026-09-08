/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // React-PDF embarque son propre moteur de composition et ses polices :
    // passé au bundler de Next, il se casse. Il doit rester externe.
    serverComponentsExternalPackages: ["@react-pdf/renderer"],

    // Les polices standard du PDF sont chargées par un require calculé au
    // moment du rendu, que l'analyse statique de Vercel ne voit pas. Sans
    // cette inclusion explicite, les fichiers restent hors de la fonction
    // serverless : ça marche en local, ça échoue en ligne.
    outputFileTracingIncludes: {
      "/**": ["./node_modules/pdfkit/js/**/*"],
      "/offre/[id]": ["./node_modules/pdfkit/js/**/*"],
      "/document/[id]": ["./node_modules/pdfkit/js/**/*"],
    },

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