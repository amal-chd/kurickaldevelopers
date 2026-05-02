import { useAuthStore } from '../store/authStore';
import { Permissions } from '../types';

export function usePermissions() {
  const { permissions } = useAuthStore();

  const can = (permission: keyof Permissions): boolean => {
    return permissions[permission] === true;
  };

  const canAny = (...perms: (keyof Permissions)[]): boolean => {
    return perms.some((p) => permissions[p] === true);
  };

  const canAll = (...perms: (keyof Permissions)[]): boolean => {
    return perms.every((p) => permissions[p] === true);
  };

  return { can, canAny, canAll, permissions };
}
