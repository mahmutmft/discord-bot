import { type ButtonInteraction } from 'discord.js';

import { getMemberFromGuild } from '@/common/utils/guild.js';
import { PartnerActionArgumentsSchema } from '@/modules/partner/schemas/PartnerListing.js';
import { closePartnerListing } from '@/modules/partner/utils/closeListing.js';
import { resolvePartnerThread } from '@/modules/partner/utils/listings.js';
import { canClosePartnerListing } from '@/modules/partner/utils/permissions.js';
import { partnerErrors, partnerMessages } from '@/translations/partner.js';

export const name = 'partnerClose';

export const execute = async (
  interaction: ButtonInteraction,
  args: string[],
) => {
  const parsed = PartnerActionArgumentsSchema.safeParse(args);
  const { guild } = interaction;

  if (guild === null || !parsed.success) {
    await interaction.editReply(partnerErrors.invalidListing);
    return;
  }

  const [, ownerId, courseKey] = parsed.data;
  const member = await getMemberFromGuild(interaction.user.id, guild);

  if (
    member === null ||
    !(await canClosePartnerListing(member, ownerId, guild))
  ) {
    await interaction.editReply(partnerErrors.listingNoPermission);
    return;
  }

  const thread = await resolvePartnerThread(
    guild,
    interaction.message.id,
    interaction.message.channelId,
  );

  if (thread === null) {
    await interaction.editReply(partnerErrors.invalidListing);
    return;
  }

  await closePartnerListing({
    courseKey,
    listingMessage: interaction.message,
    ownerId,
    thread,
  });
  await interaction.editReply(partnerMessages.listingClosed);
};
