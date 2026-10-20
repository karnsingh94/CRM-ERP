export const TEAM_PERMISSION_KEYS = [
  'manageMembers',
  'assignWork',
  'updateWork',
  'manageServiceRecords',
];

export function normalizeTeamPermissions(value) {
  const permissions = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return Object.fromEntries(TEAM_PERMISSION_KEYS.map((key) => [key, permissions[key] === true]));
}

export function validateTeamPermissions(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (TEAM_PERMISSION_KEYS.some((key) => typeof value[key] !== 'boolean')) return null;
  return normalizeTeamPermissions(value);
}
