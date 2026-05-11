export const useEffectivePermissions = (_userId?: number) => ({
  loading: false,
  canView: (_field: string) => true,
  canCreate: (_field: string) => true,
  canEdit: (_field: string) => true,
  lastUpdated: 0,
});
