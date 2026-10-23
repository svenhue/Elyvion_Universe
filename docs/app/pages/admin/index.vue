<script setup lang="ts">
interface RegistryModule {
  id: string
  name: string
  type: 'ts' | 'py'
  baseUrl: string
  routePrefix: string
  healthCheckUrl: string
  version: string
  status: 'healthy' | 'unhealthy' | 'unknown'
  lastSeenAt: string
}

interface OidcClient {
  client_id: string
  client_name?: string
  redirect_uris: string[]
  grant_types: string[]
}

const config = useRuntimeConfig()

const {
  data: modules,
  error: modulesError,
  refresh: refreshModules,
} = await useFetch<{ data: RegistryModule[] }>(`${config.public.registryUrl}/modules`, {
  server: false,
})

const { data: discovery } = await useFetch<{ issuer: string; registration_endpoint?: string }>(
  `${config.public.authIssuerUrl}/.well-known/openid-configuration`,
  { server: false },
)

// The seeded client list lives in code (backend/modules/auth/src/oidc/clients.ts),
// not behind an API — shown here for visibility until self-service registration exists.
const seededClients: OidcClient[] = [
  {
    client_id: 'elyvion-client',
    client_name: 'Elyvion Frontend Skeleton',
    redirect_uris: ['http://localhost:4200/auth/callback', 'http://localhost:4300/auth/callback'],
    grant_types: ['authorization_code', 'refresh_token'],
  },
]

let interval: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  interval = setInterval(() => refreshModules(), 15_000)
})
onUnmounted(() => interval && clearInterval(interval))

function statusColor(status: RegistryModule['status']) {
  if (status === 'healthy') return 'success'
  if (status === 'unhealthy') return 'error'
  return 'neutral'
}
</script>

<template>
  <div class="space-y-10">
    <div>
      <h1 class="text-2xl font-bold mb-1">Admin-Panel</h1>
      <p class="text-muted text-sm">
        Live-Ansicht der Registry (<code>{{ config.public.registryUrl }}</code>) und des
        Auth-Providers (<code>{{ config.public.authIssuerUrl }}</code>). Aktualisiert alle 15s.
      </p>
    </div>

    <section>
      <h2 class="text-lg font-semibold mb-3">Registrierte Module</h2>

      <UAlert
        v-if="modulesError"
        color="error"
        variant="subtle"
        title="Registry nicht erreichbar"
        :description="`Ist 'modules/registry' gestartet? (${config.public.registryUrl})`"
      />

      <UTable
        v-else
        :data="modules?.data ?? []"
        :columns="[
          { accessorKey: 'name', header: 'Name' },
          { accessorKey: 'type', header: 'Typ' },
          { accessorKey: 'status', header: 'Status' },
          { accessorKey: 'baseUrl', header: 'Base URL' },
          { accessorKey: 'version', header: 'Version' },
          { accessorKey: 'lastSeenAt', header: 'Zuletzt gesehen' },
        ]"
      >
        <template #status-cell="{ row }">
          <UBadge :color="statusColor(row.original.status)" variant="subtle">
            {{ row.original.status }}
          </UBadge>
        </template>
      </UTable>
    </section>

    <section>
      <h2 class="text-lg font-semibold mb-3">OIDC-Clients</h2>
      <p class="text-sm text-muted mb-3">
        Issuer: <code>{{ discovery?.issuer ?? config.public.authIssuerUrl }}</code>
      </p>
      <UTable
        :data="seededClients"
        :columns="[
          { accessorKey: 'client_id', header: 'Client ID' },
          { accessorKey: 'client_name', header: 'Name' },
          { accessorKey: 'redirect_uris', header: 'Redirect URIs' },
          { accessorKey: 'grant_types', header: 'Grant Types' },
        ]"
      >
        <template #redirect_uris-cell="{ row }">
          <div class="text-xs space-y-0.5">
            <div v-for="uri in row.original.redirect_uris" :key="uri">{{ uri }}</div>
          </div>
        </template>
        <template #grant_types-cell="{ row }">
          {{ row.original.grant_types.join(', ') }}
        </template>
      </UTable>
    </section>
  </div>
</template>
