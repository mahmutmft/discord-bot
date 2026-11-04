import { type Message, type ThreadChannel } from 'discord.js';

import {
  getClosedPartnerListingEmbed,
  getPartnerListingComponents,
} from '@/modules/partner/components/components.js';

type ClosePartnerListingOptions = {
  courseKey: string;
  listingMessage: Message;
  ownerId: string;
  thread: ThreadChannel;
};

export const closePartnerListing = async ({
  courseKey,
  listingMessage,
  ownerId,
  thread,
}: ClosePartnerListingOptions) => {
  if (!thread.locked) {
    await thread.setLocked(true, 'Partner finder listing closed');
  }
  if (!thread.archived) {
    await thread.setArchived(true, 'Partner finder listing closed');
  }
  const currentEmbed = listingMessage.embeds[0];
  await listingMessage.edit({
    components: [
      getPartnerListingComponents({
        courseKey,
        disabled: true,
        ownerId,
      }),
    ],
    ...(currentEmbed !== undefined && {
      embeds: [getClosedPartnerListingEmbed(currentEmbed)],
    }),
  });
};
