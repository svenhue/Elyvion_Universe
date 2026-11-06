# Local LLM

The `local-llm` module is the single OpenAI-compatible chat-completion
endpoint for the platform. It forwards chat and tool-call requests to the
configured local Ollama server. Chat and Agent Engine both use this module;
they do not call Ollama or a cloud provider directly.

## Run Ollama locally

From `backend/`:

```sh
docker compose up -d ollama
docker compose exec ollama ollama pull qwen3:4b
```

Ollama stores model files in the persistent `ollama-data` Docker volume and
publishes port `11434` on loopback only for local development. For services running as
containers on the same Compose network, configure the URL as
`http://ollama:11434`; processes on the host use `http://localhost:11434`.

Start the backend module with `.env.example` copied to `.env`. Its Mongo
database stores a singleton `scope: "global"` configuration.

## Admin configuration

The existing generic Admin UI contains **Local LLM: Plattform-Konfiguration**.
It manages the Ollama URL, model, temperature, and context size. Scope is
displayed as `global` and intentionally cannot be edited because there is one
platform-wide provider configuration.

Only users with `tenant-admin` in the designated platform-admin tenant may
read or edit this configuration. Set `LOCAL_LLM_ADMIN_TENANT_ID` in the
module, create/use that dedicated tenant, and assign platform operators to
its `tenant-admin` role. Do not use an ordinary customer tenant for this
setting. The role and `ai.llm.read` / `ai.llm.configure` permissions are
created by the Security migration.

The completion proxy also requires a shared internal service token. Create
one random token outside the repository and mount the same read-only file at
`LOCAL_LLM_SERVICE_TOKEN_FILE` in Local LLM, Chat, and Agent Engine. Do not
put its value in `.env`, Compose, logs, or frontend state.

The Ollama URL is admin-editable as requested. It must use HTTP or HTTPS and
must not contain credentials, query parameters, or fragments. Protect the
admin account: a trusted administrator can direct LLM traffic to any
reachable endpoint.

## API

- `GET /configuration` — authorized admin-only singleton configuration.
- `GET /configurations` — authorized list for the Admin UI.
- `PATCH /configurations/global` — authorized update; changing the URL,
  model, temperature, or context is immediately used by new completions.
- `POST /v1/chat/completions` — internal OpenAI-compatible chat completion
  proxy. Model and generation settings always come from the global config;
  requests require the internal service token.

Do not expose the completion endpoint directly to the public Internet; route
application traffic through the platform gateway/internal network.
