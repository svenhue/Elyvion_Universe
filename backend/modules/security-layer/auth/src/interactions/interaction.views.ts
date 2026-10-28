const shell = (title: string, body: string) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title} · Elyvion Auth</title>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; background: #0f172a; color: #e2e8f0;
           display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: #1e293b; padding: 2.5rem; border-radius: 12px; width: 320px; box-shadow: 0 10px 30px rgba(0,0,0,.3); }
    h1 { font-size: 1.25rem; margin: 0 0 1.5rem; }
    label { display: block; font-size: .85rem; margin-bottom: .25rem; color: #94a3b8; }
    input { width: 100%; padding: .6rem; margin-bottom: 1rem; border-radius: 6px; border: 1px solid #334155;
            background: #0f172a; color: #e2e8f0; box-sizing: border-box; }
    button { width: 100%; padding: .65rem; border-radius: 6px; border: none; background: #6366f1; color: white;
             font-weight: 600; cursor: pointer; }
    button:hover { background: #4f46e5; }
    .error { color: #f87171; font-size: .85rem; margin-bottom: 1rem; }
    .scopes { list-style: none; padding: 0; margin: 0 0 1.5rem; font-size: .9rem; color: #cbd5e1; }
    .scopes li { padding: .25rem 0; }
  </style>
</head>
<body>
  <div class="card">${body}</div>
</body>
</html>`;

export function renderLoginPage(opts: { uid: string; clientId: string; error?: string }) {
  return shell(
    'Sign in',
    `
    <h1>Sign in to continue</h1>
    ${opts.error ? `<div class="error">${opts.error}</div>` : ''}
    <form method="post" action="/interaction/${opts.uid}/login">
      <label for="email">Email</label>
      <input id="email" name="email" type="email" autocomplete="username" required />
      <label for="password">Password</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required />
      <button type="submit">Sign in</button>
    </form>
  `,
  );
}

export function renderConsentPage(opts: { uid: string; scope: string }) {
  const scopes = opts.scope.split(' ').filter(Boolean);
  return shell(
    'Authorize',
    `
    <h1>Authorize this application</h1>
    <ul class="scopes">${scopes.map((s) => `<li>&middot; ${s}</li>`).join('')}</ul>
    <form method="post" action="/interaction/${opts.uid}/confirm">
      <button type="submit">Allow</button>
    </form>
  `,
  );
}
