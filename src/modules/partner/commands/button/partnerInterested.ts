import { type ButtonInteraction } from 'discord.js';

import { getPartnerListingComponents } from '@/modules/partner/components/components.js';
import { PartnerActionArgumentsSchema } from '@/modules/partner/schemas/PartnerListing.js';
import { withPartnerListingLock } from '@/modules/partner/utils/listingLock.js';
import { resolvePartnerThread } from '@/modules/partner/utils/listings.js';
import {
  partnerErrors,
  partnerMessageFunctions,
  partnerMessages,
} from '@/translations/partner.js';

export const name = 'partnerInterested';

type DisableJoinActionOptions = {
  courseKey: string;
  interaction: ButtonInteraction;
  needed: number | undefined;
  ownerId: string;
};

const disableJoinAction = async ({
  courseKey,
  interaction,
  needed,
  ownerId,
}: DisableJoinActionOptions) => {
  try {
    await interaction.message.edit({
      components: [
        getPartnerListingComponents({
          courseKey,
          disabled: true,
          needed,
          ownerId,
        }),
      ],
    });
  } catch {
    // Disabling stale or full controls is best-effort.
  }
};

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

  const [, ownerId, courseKey, needed] = parsed.data;

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
    await disableJoinAction({ courseKey, interaction, needed, ownerId });

    await interaction.editReply(partnerErrors.invalidListing);
    return;
  }

  await withPartnerListingLock(interaction.message.id, async () => {
    const members = await thread.members.fetch();
    if (members.has(interaction.user.id)) {
      await interaction.editReply(partnerMessages.alreadyInterested);
      return;
    }

    let interestedCount = 0;
    for (const memberId of members.keys()) {
      if (memberId !== ownerId && memberId !== interaction.client.user.id) {
        interestedCount += 1;
      }
    }

    if (needed !== undefined && interestedCount >= needed) {
      await disableJoinAction({ courseKey, interaction, needed, ownerId });
      await interaction.editReply(partnerErrors.listingFull);
      return;
    }

    await thread.members.add(interaction.user.id);
    if (needed !== undefined && interestedCount + 1 >= needed) {
      await disableJoinAction({ courseKey, interaction, needed, ownerId });
    }
    await interaction.editReply(partnerMessageFunctions.interested(thread.id));
  });
};
