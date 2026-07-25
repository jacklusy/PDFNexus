import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PERMISSION_KEY = 'admin_require_permission';

export const RequirePermission = (...permissions: string[]) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permissions);
