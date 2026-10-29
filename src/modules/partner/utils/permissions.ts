import { type Guild, type GuildMember, PermissionFlagsBits } from 'discord.js';

import { Role } from '@/common/schemas/Role.js';
import { getRolesProperty } from '@/configuration/bot/index.js';

export const canClosePartnerListing = async (
  member: GuildMember,
  ownerId: string,
  guild: Guild,
) => {
  if (
    member.id === ownerId ||
    member.permissions.has(PermissionFlagsBits.ManageMessages)
  ) {
    return true;
  }

  const moderatorRole = await getRolesProperty(Role.Moderators, guild.id);

  return moderatorRole !== undefined && member.roles.cache.has(moderatorRole);
};
