// Contrôle des rôles (autorisation).
// La signature et l'expiration du jeton sont déjà vérifiées par Kong (plugin jwt) :
// l'API ne reçoit que des requêtes passées par la passerelle. Elle lit ici les
// rôles Keycloak (claim realm_access.roles) pour décider de l'accès (403 sinon).

function decodePayload(authorization) {
  if (!authorization || !authorization.startsWith('Bearer ')) return null;
  const parts = authorization.slice(7).split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const payload = decodePayload(req.headers.authorization);
    if (!payload) {
      return res.status(401).json({ error: 'Jeton absent ou illisible' });
    }
    const roles = payload.realm_access?.roles || [];
    if (!allowedRoles.some((role) => roles.includes(role))) {
      return res.status(403).json({
        error: 'Accès refusé : rôle insuffisant',
        requis: allowedRoles,
        utilisateur: payload.preferred_username,
        roles,
      });
    }
    req.user = { username: payload.preferred_username, roles, client: payload.azp };
    next();
  };
}

module.exports = { requireRole };
