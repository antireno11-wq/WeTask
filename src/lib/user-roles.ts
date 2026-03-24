import { UserRole } from "@prisma/client";

type RoleAssignmentShape =
  | { role: { code: UserRole } }
  | { code: UserRole };

type UserRoleShape = {
  role: UserRole;
  roleAssignments?: RoleAssignmentShape[];
};

export function hasAssignedRole(user: UserRoleShape | null | undefined, expected: UserRole) {
  if (!user) return false;
  if (user.role === expected) return true;
  return Boolean(
    user.roleAssignments?.some((assignment) => ("role" in assignment ? assignment.role.code : assignment.code) === expected)
  );
}

export function resolveLoginRole(user: UserRoleShape, requestedRole?: UserRole | null) {
  if (!requestedRole) return user.role;
  return hasAssignedRole(user, requestedRole) ? requestedRole : user.role;
}

