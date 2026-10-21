export const TEAM_PERMISSION_KEYS = [
  'manageMembers',
  'assignWork',
  'updateWork',
  'manageServiceRecords',
];

export function normalizeTeamPermissions(value) {
  const permissions = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const featureAccess = permissions.featureAccess && typeof permissions.featureAccess === 'object'
    ? permissions.featureAccess
    : {};
  return {
    ...Object.fromEntries(TEAM_PERMISSION_KEYS.map((key) => [key, permissions[key] === true])),
    featureAccess: {
      moduleIds: Array.isArray(featureAccess.moduleIds) ? featureAccess.moduleIds.map(String) : [],
      subModuleIds: Array.isArray(featureAccess.subModuleIds) ? featureAccess.subModuleIds.map(String) : [],
    },
  };
}

export function validateTeamPermissions(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (TEAM_PERMISSION_KEYS.some((key) => typeof value[key] !== 'boolean')) return null;
  const featureAccess = value.featureAccess;
  if (
    featureAccess !== undefined &&
    (!featureAccess || typeof featureAccess !== 'object' || Array.isArray(featureAccess) ||
      (featureAccess.moduleIds !== undefined && !Array.isArray(featureAccess.moduleIds)) ||
      (featureAccess.subModuleIds !== undefined && !Array.isArray(featureAccess.subModuleIds)))
  ) return null;
  return normalizeTeamPermissions(value);
}
