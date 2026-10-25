// Tests de bout en bout : client -> Keycloak (jeton) -> Kong -> API -> PostgreSQL
// Lancement : docker compose --profile test run --rm tests
// (ou depuis l'hôte avec Node 18+ : KONG_URL=http://localhost:8000 KEYCLOAK_URL=http://localhost:8080 node tests/run-tests.js)
const crypto = require('crypto');

const KONG = process.env.KONG_URL || 'http://localhost:8000';
const KC = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const REALM = process.env.KEYCLOAK_REALM || 'ibam-realm';
const PRODUCTS = `${KONG}/api/v1/products`;
const SUPPLIERS = `${KONG}/api/v1/suppliers`;
const RATE_LIMIT_PER_MINUTE = 10;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];

async function waitFor(url, label) {
  for (let i = 0; i < 90; i++) {
    try { await fetch(url); return; } catch { await sleep(2000); }
  }
  throw new Error(`${label} injoignable (${url})`);
}

async function getToken(username, password, clientId) {
  const res = await fetch(`${KC}/realms/${REALM}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'password', client_id: clientId, username, password }),
  });
  const body = await res.json();
  if (!body.access_token) throw new Error(`Jeton refusé pour ${username}/${clientId} : ${JSON.stringify(body)}`);
  return body.access_token;
}

async function call(method, url, token, body) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* texte brut */ }
  return { status: res.status, json, text, headers: res.headers };
}

async function check(id, scenario, expected, method, url, token, body) {
  const r = await call(method, url, token, body);
  const ok = r.status === expected;
  const detail = r.json?.message || r.json?.error || '';
  results.push({ id, scenario, attendu: expected, obtenu: r.status, resultat: ok ? 'OK' : 'ÉCHEC', detail });
  console.log(`${ok ? '✔' : '✘'} [${id}] ${scenario} -> attendu ${expected}, obtenu ${r.status}${detail ? ` (${detail})` : ''}`);
  return r;
}

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

// Jeton bien formé mais signé avec une clé qui n'est pas celle de Keycloak
function forgeToken(realToken) {
  const [h, p] = realToken.split('.');
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const sig = crypto.sign('RSA-SHA256', Buffer.from(`${h}.${p}`), privateKey).toString('base64url');
  return `${h}.${p}.${sig}`;
}

// Vrai jeton de user1 dont on modifie le contenu (ajout du rôle admin) sans pouvoir re-signer
function tamperToken(realToken) {
  const [h, p, s] = realToken.split('.');
  const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
  payload.realm_access = { roles: ['user', 'admin'] };
  return `${h}.${b64url(payload)}.${s}`;
}

async function waitForFreshMinute() {
  // Les quotas Kong sont comptés par minute calendaire : on démarre au début
  // d'une minute pour que tous les tests tombent dans la même fenêtre.
  const s = new Date().getSeconds();
  if (s > 2) {
    console.log(`Attente de ${60 - s} s pour démarrer au début d'une minute (quotas remis à zéro)...\n`);
    await sleep((60 - s) * 1000 + 500);
  }
}

(async () => {
  console.log(`Kong : ${KONG} | Keycloak : ${KC}/realms/${REALM}\n`);
  await waitFor(`${KC}/realms/${REALM}`, 'Keycloak');
  await waitFor(KONG, 'Kong');

  const tokens = {
    adminProd: await getToken('admin1', 'admin123', 'app-produits'),
    userProd: await getToken('user1', 'password123', 'app-produits'),
    noRoleProd: await getToken('sansrole1', 'test123', 'app-produits'),
    adminSupp: await getToken('admin1', 'admin123', 'app-fournisseurs'),
    userSupp: await getToken('user1', 'password123', 'app-fournisseurs'),
  };
  console.log('Jetons obtenus auprès de Keycloak pour admin1, user1 et sansrole1.\n');

  await waitForFreshMinute();

  console.log('--- 1. Accès autorisé + test de bout en bout (API Produits, client app-produits) ---');
  await check('A1', 'admin1 liste les produits', 200, 'GET', `${PRODUCTS}?page=1&limit=5`, tokens.adminProd);
  await check('A2', 'admin1 consulte le produit 101', 200, 'GET', `${PRODUCTS}/101`, tokens.adminProd);
  const created = await check('A3', 'admin1 crée un produit', 201, 'POST', PRODUCTS, tokens.adminProd,
    { name: 'Produit de test E2E', price: 9900, stock: 3, supplier_id: 1 });
  const newId = created.json?.data?.id;
  const reread = await check('A4', 'relecture du produit créé (lu en base)', 200, 'GET', `${PRODUCTS}/${newId}`, tokens.adminProd);
  if (reread.json?.data?.name !== 'Produit de test E2E') {
    results.push({ id: 'A4b', scenario: 'contenu relu identique', attendu: 'Produit de test E2E', obtenu: reread.json?.data?.name, resultat: 'ÉCHEC', detail: '' });
    console.log('✘ [A4b] le produit relu ne correspond pas');
  }
  await check('A5', 'admin1 modifie le produit', 200, 'PUT', `${PRODUCTS}/${newId}`, tokens.adminProd, { stock: 7 });
  await check('A6', 'user1 (rôle user) lit les produits', 200, 'GET', PRODUCTS, tokens.userProd);

  console.log('\n--- 2. Rôle insuffisant (403 renvoyé par l\'API) ---');
  await check('R1', 'user1 tente de créer un produit', 403, 'POST', PRODUCTS, tokens.userProd, { name: 'Interdit', price: 1 });
  await check('R2', 'sansrole1 tente de lire les produits', 403, 'GET', PRODUCTS, tokens.noRoleProd);
  await check('A7', 'admin1 supprime le produit de test', 204, 'DELETE', `${PRODUCTS}/${newId}`, tokens.adminProd);

  console.log('\n--- 3. API Fournisseurs (client app-fournisseurs) ---');
  await check('F1', 'admin1 liste les fournisseurs actifs', 200, 'GET', `${SUPPLIERS}?status=actif`, tokens.adminSupp);
  await check('F2', 'user1 consulte le fournisseur 1', 200, 'GET', `${SUPPLIERS}/1`, tokens.userSupp);
  await check('F3', 'user1 tente de supprimer le fournisseur 1', 403, 'DELETE', `${SUPPLIERS}/1`, tokens.userSupp);

  console.log('\n--- 4. Jeton absent ou invalide (401 renvoyé par Kong) ---');
  await check('J1', 'jeton absent', 401, 'GET', PRODUCTS, null);
  await check('J2', 'jeton invalide (chaîne quelconque)', 401, 'GET', PRODUCTS, 'faux_token_123');
  await check('J3', 'jeton signé par une autre clé', 401, 'GET', PRODUCTS, forgeToken(tokens.adminProd));
  await check('J4', 'jeton de user1 modifié pour devenir admin', 401, 'POST', PRODUCTS, tamperToken(tokens.userProd), { name: 'Pirate', price: 1 });

  console.log('\n--- 5. Client non autorisé sur une API (403 renvoyé par Kong, plugin ACL) ---');
  await check('C1', 'jeton du client app-produits sur l\'API Fournisseurs', 403, 'GET', SUPPLIERS, tokens.adminProd);

  console.log(`\n--- 6. Dépassement de quota (${RATE_LIMIT_PER_MINUTE} requêtes/minute par client) ---`);
  let got429 = null;
  for (let i = 1; i <= RATE_LIMIT_PER_MINUTE + 5; i++) {
    const r = await call('GET', SUPPLIERS, tokens.adminSupp);
    const remaining = r.headers.get('x-ratelimit-remaining-minute');
    console.log(`   requête ${i} -> ${r.status}${remaining !== null ? ` (restant : ${remaining})` : ''}`);
    if (r.status === 429) { got429 = r; break; }
  }
  results.push({ id: 'Q1', scenario: 'quota dépassé pour app-fournisseurs', attendu: 429, obtenu: got429 ? 429 : 'aucun 429', resultat: got429 ? 'OK' : 'ÉCHEC', detail: got429?.json?.message || '' });
  console.log(`${got429 ? '✔' : '✘'} [Q1] quota dépassé pour app-fournisseurs -> ${got429 ? `429 (${got429.json?.message})` : 'aucun 429 reçu'}`);
  // Le quota est propre à chaque client : app-produits n'est pas bloqué
  await check('Q2', 'app-produits reste autorisé (quota indépendant)', 200, 'GET', `${PRODUCTS}/101`, tokens.adminProd);

  const failed = results.filter((r) => r.resultat !== 'OK');
  console.log('\n================ RÉSUMÉ ================');
  console.table(results.map(({ id, scenario, attendu, obtenu, resultat }) => ({ id, scenario, attendu, obtenu, resultat })));
  console.log(failed.length ? `${failed.length} test(s) en échec.` : `Tous les tests sont réussis (${results.length}/${results.length}).`);
  process.exit(failed.length ? 1 : 0);
})().catch((err) => {
  console.error(`Erreur pendant les tests : ${err.message}`);
  process.exit(1);
});
