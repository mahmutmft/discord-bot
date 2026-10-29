import { type ButtonInteraction } from 'discord.js';

import { getPartnerListingComponents } from '@/modules/partner/components/components.js';
import { PartnerActionArgumentsSchema } from '@/modules/partner/schemas/PartnerListing.js';
import { resolvePartnerThread } from '@/modules/partner/utils/listings.js';
import {
  partnerErrors,
  partnerMessageFunctions,
  partnerMessages,
} from '@/translations/partner.js';

export const name = 'partnerInterested';

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

  if (interaction.user.id === ownerId) {
    await interaction.editReply(partnerErrors.cannotJoinOwnListing);
    return;
  }

  const thread = await resolvePartnerThread(
    guild,
    interaction.message.id,
    interaction.message.channelId,
  );

  if (thread === null || thread.archived || thread.locked) {
    try {
      await interaction.message.edit({
        components: [
          getPartnerListingComponents({
            courseKey,
            disabled: true,
            ownerId,
          }),
        ],
      });
    } catch {
      // Disabling stale controls is best-effort.
    }

    await interaction.editReply(partnerErrors.invalidListing);
    return;
  }

  const members = await thread.members.fetch();
  if (members.has(interaction.user.id)) {
    await interaction.editReply(partnerMessages.alreadyInterested);
    return;
  }

  await thread.members.add(interaction.user.id);
  await interaction.editReply(partnerMessageFunctions.interested(thread.id));
};
