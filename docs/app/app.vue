<script setup lang="ts">
const navLinks = [
  { label: 'Übersicht', to: '/' },
  { label: 'Architektur', to: '/architecture' },
  { label: 'Patterns', to: '/patterns' },
  { label: 'Best Practices', to: '/best-practices' },
  { label: 'Services', to: '/services' },
  { label: 'Dynamic Rendering', to: '/dynamic-rendering' },
  { label: 'Admin', to: '/admin' },
]
</script>

<template>
  <UApp>
    <NuxtRouteAnnouncer />
    <div class="min-h-screen bg-default">
      <header class="border-b border-default">
        <div class="mx-auto max-w-5xl flex items-center gap-6 px-6 py-4">
          <NuxtLink to="/" class="font-bold text-lg">Elyvion Universe</NuxtLink>
          <nav class="flex gap-4 text-sm">
            <NuxtLink
              v-for="link in navLinks"
              :key="link.to"
              :to="link.to"
              class="text-muted hover:text-default transition-colors"
            >
              {{ link.label }}
            </NuxtLink>
          </nav>
        </div>
      </header>
      <main class="mx-auto max-w-5xl px-6 py-10">
        <NuxtPage />
      </main>
    </div>
  </UApp>
</template>
