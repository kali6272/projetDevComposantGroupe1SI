// Génère la configuration déclarative de Kong avec la clé publique RSA
// actuelle du realm Keycloak. Exécuté par le conteneur kong-init avant Kong.
const fs = require('fs');
const path = require('path');

const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://keycloak:8080';
const REALM = process.env.KEYCLOAK_REALM || 'ibam-realm';
const TEMPLATE_PATH = process.env.TEMPLATE_PATH || '/kong/kong.template.yml';
const OUTPUT_PATH = process.env.OUTPUT_PATH || '/kong-config/kong.yml';
const MAX_ATTEMPTS = Number(process.env.MAX_ATTEMPTS || 90); // ~3 minutes

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchPublicKey() {
  const url = `${KEYCLOAK_URL}/realms/${REALM}`;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const body = await res.json();
        if (body.public_key) return body.public_key;
      }
      console.log(`[kong-init] Realm pas encore prêt (HTTP ${res.status}), tentative ${attempt}/${MAX_ATTEMPTS}`);
    } catch (err) {
      console.log(`[kong-init] Keycloak injoignable (${err.cause?.code || err.message}), tentative ${attempt}/${MAX_ATTEMPTS}`);
    }
    await sleep(2000);
  }
  throw new Error(`Impossible de récupérer la clé publique depuis ${url}`);
}

function toPem(base64Key) {
  const lines = base64Key.match(/.{1,64}/g).join('\n');
  return `-----BEGIN PUBLIC KEY-----\n${lines}\n-----END PUBLIC KEY-----\n`;
}

(async () => {
  const publicKey = await fetchPublicKey();
  const pem = toPem(publicKey);
  const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  // JSON.stringify produit une chaîne YAML valide (guillemets doubles, \n échappés)
  const config = template.split('__RSA_PUBLIC_KEY__').join(JSON.stringify(pem));
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, config, { mode: 0o644 });
  console.log(`[kong-init] ${OUTPUT_PATH} généré avec la clé publique du realm "${REALM}".`);
})().catch((err) => {
  console.error(`[kong-init] ÉCHEC : ${err.message}`);
  process.exit(1);
});
