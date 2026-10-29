import {
  ChannelType,
  ComponentType,
  type Guild,
  type Message,
  type TextChannel,
  type ThreadChannel,
} from 'discord.js';
import { createHash } from 'node:crypto';

import { PARTNER_CLOSE_BUTTON_ID } from '../constants.js';

export const getPartnerCourseKey = (course: string) =>
  createHash('sha256').update(course).digest('base64url').slice(0, 12);

export const getPartnerCloseCustomId = (
  message: Pick<Message, 'components'>,
): null | string => {
  for (const row of message.components) {
    if (row.type !== ComponentType.ActionRow) {
      continue;
    }

    for (const component of row.components) {
      if (
        component.type === ComponentType.Button &&
        component.customId?.startsWith(`${PARTNER_CLOSE_BUTTON_ID}:`)
      ) {
        return component.customId;
      }
    }
  }

  return null;
};

export const hasActivePartnerListing = async (
  channel: TextChannel,
  ownerId: string,
  courseKey: string,
): Promise<boolean> => {
  const expectedId = `${PARTNER_CLOSE_BUTTON_ID}:v1:${ownerId}:${courseKey}`;
  const { threads } = await channel.threads.fetchActive();

  for (const thread of threads.values()) {
    if (thread.parentId !== channel.id || thread.locked) {
      continue;
    }

    try {
      const starterMessage = await thread.fetchStarterMessage();
      if (
        starterMessage !== null &&
        getPartnerCloseCustomId(starterMessage) === expectedId
      ) {
        return true;
      }
    } catch {
      // A deleted or inaccessible starter message cannot represent an active listing.
    }
  }

  return false;
};

export const resolvePartnerThread = async (
  guild: Guild,
  messageId: string,
  parentChannelId: string,
): Promise<null | ThreadChannel> => {
  try {
    const channel = await guild.channels.fetch(messageId);

    return channel !== null &&
      channel.isThread() &&
      channel.type === ChannelType.PublicThread &&
      channel.parentId === parentChannelId
      ? channel
      : null;
  } catch {
    return null;
  }
};
