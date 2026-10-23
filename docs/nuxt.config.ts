// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/content', '@nuxt/ui'],
  devtools: { enabled: true },
  compatibilityDate: '2024-04-03',
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    public: {
      registryUrl: process.env.NUXT_PUBLIC_REGISTRY_URL || 'http://localhost:3010',
      authIssuerUrl: process.env.NUXT_PUBLIC_AUTH_ISSUER_URL || 'http://localhost:3011',
      gatewayUrl: process.env.NUXT_PUBLIC_GATEWAY_URL || 'http://localhost:3000',
    },
  },
})
