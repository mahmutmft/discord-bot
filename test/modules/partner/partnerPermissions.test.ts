import { type Guild, type GuildMember } from 'discord.js';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { canClosePartnerListing } from '@/modules/partner/utils/permissions.js';

const mocks = vi.hoisted(() => ({
  getRolesProperty:
    vi.fn<(role: string, guildId: string) => Promise<string | undefined>>(),
}));

vi.mock('@/configuration/bot/index.js', () => ({
  getRolesProperty: mocks.getRolesProperty,
}));

const GUILD_ID = '123456789012345678';
const MODERATOR_ROLE_ID = '223456789012345678';
const OWNER_ID = '323456789012345678';
const USER_ID = '423456789012345678';

const createMember = (options?: {
  hasManageMessages?: boolean;
  hasModeratorRole?: boolean;
  id?: string;
}) =>
  ({
    id: options?.id ?? USER_ID,
    permissions: {
      has: vi.fn<(permission: bigint) => boolean>(
        () => options?.hasManageMessages ?? false,
      ),
    },
    roles: {
      cache: {
        has: vi.fn<(roleId: string) => boolean>(
          () => options?.hasModeratorRole ?? false,
        ),
      },
    },
  }) as unknown as GuildMember;

const guild = { id: GUILD_ID } as Guild;

describe('partner close permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRolesProperty.mockResolvedValue(MODERATOR_ROLE_ID);
  });

  test('allows the listing owner without a role lookup', async () => {
    const member = createMember({ id: OWNER_ID });

    await expect(canClosePartnerListing(member, OWNER_ID, guild)).resolves.toBe(
      true,
    );
    expect(mocks.getRolesProperty).not.toHaveBeenCalled();
  });

  test('does not treat Manage Messages as a configured partner moderator', async () => {
    const member = createMember({ hasManageMessages: true });
    mocks.getRolesProperty.mockResolvedValue(undefined);

    await expect(canClosePartnerListing(member, OWNER_ID, guild)).resolves.toBe(
      false,
    );
  });

  test('allows the configured moderator role', async () => {
    const member = createMember({ hasModeratorRole: true });

    await expect(canClosePartnerListing(member, OWNER_ID, guild)).resolves.toBe(
      true,
    );
    expect(mocks.getRolesProperty).toHaveBeenCalledWith('moderators', GUILD_ID);
  });

  test('rejects ordinary members and missing moderator configuration', async () => {
    const member = createMember();
    mocks.getRolesProperty.mockResolvedValue(undefined);

    await expect(canClosePartnerListing(member, OWNER_ID, guild)).resolves.toBe(
      false,
    );
  });
});
