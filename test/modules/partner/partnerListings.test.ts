import {
  ComponentType,
  type Guild,
  type Message,
  type TextChannel,
} from 'discord.js';
import { describe, expect, test, vi } from 'vitest';

import {
  getPartnerCloseCustomId,
  getPartnerCourseKey,
  hasActivePartnerListing,
  resolvePartnerThread,
} from '@/modules/partner/utils/listings.js';

const COURSE = 'Тимски проект';
const COURSE_KEY = getPartnerCourseKey(COURSE);
const OWNER_ID = '123456789012345678';
const CLOSE_ID = `partnerClose:v1:${OWNER_ID}:${COURSE_KEY}`;
const COURSE_KEY_PATTERN = /^[\w-]{12}$/u;

const messageWithCloseButton = (customId = CLOSE_ID) =>
  ({
    components: [
      {
        components: [{ customId, type: ComponentType.Button }],
        type: ComponentType.ActionRow,
      },
    ],
  }) as unknown as Pick<Message, 'components'>;

describe('partner listing persistence', () => {
  test('creates stable opaque course keys', () => {
    expect(COURSE_KEY).toMatch(COURSE_KEY_PATTERN);
    expect(getPartnerCourseKey(COURSE)).toBe(COURSE_KEY);
    expect(getPartnerCourseKey('Самостоен проект')).not.toBe(COURSE_KEY);
  });

  test('extracts only the partner close metadata', () => {
    expect(getPartnerCloseCustomId(messageWithCloseButton())).toBe(CLOSE_ID);
    expect(
      getPartnerCloseCustomId(messageWithCloseButton('other:v1:value')),
    ).toBeNull();
  });

  test('finds an active listing from Discord thread state', async () => {
    const fetchStarterMessage = vi.fn<
      () => Promise<Pick<Message, 'components'>>
    >(async () => messageWithCloseButton());
    const channel = {
      id: 'channel-id',
      threads: {
        fetchActive: async () => ({
          threads: new Map([
            [
              'thread-id',
              {
                fetchStarterMessage,
                locked: false,
                parentId: 'channel-id',
              },
            ],
          ]),
        }),
      },
    } as unknown as TextChannel;

    await expect(
      hasActivePartnerListing(channel, OWNER_ID, COURSE_KEY),
    ).resolves.toBe(true);
    expect(fetchStarterMessage).toHaveBeenCalledOnce();
  });

  test('ignores inaccessible, locked, and unrelated threads', async () => {
    const channel = {
      id: 'channel-id',
      threads: {
        fetchActive: async () => ({
          threads: new Map([
            [
              'inaccessible',
              {
                fetchStarterMessage: async () => {
                  throw new Error('deleted');
                },
                locked: false,
                parentId: 'channel-id',
              },
            ],
            [
              'locked',
              {
                fetchStarterMessage: vi.fn<() => Promise<null>>(
                  async () => null,
                ),
                locked: true,
                parentId: 'channel-id',
              },
            ],
            [
              'unrelated',
              {
                fetchStarterMessage: async () =>
                  messageWithCloseButton(
                    'partnerClose:v1:999999999999999999:Abcdef123456',
                  ),
                locked: false,
                parentId: 'channel-id',
              },
            ],
          ]),
        }),
      },
    } as unknown as TextChannel;

    await expect(
      hasActivePartnerListing(channel, OWNER_ID, COURSE_KEY),
    ).resolves.toBe(false);
  });

  test('resolves only the public thread attached to the listing message', async () => {
    const thread = {
      isThread: () => true,
      parentId: 'parent-id',
      type: 11,
    };
    const guild = {
      channels: {
        fetch: vi.fn<(id: string) => Promise<typeof thread>>(
          async () => thread,
        ),
      },
    } as unknown as Guild;

    await expect(
      resolvePartnerThread(guild, 'message-id', 'parent-id'),
    ).resolves.toBe(thread);
    await expect(
      resolvePartnerThread(guild, 'message-id', 'different-parent'),
    ).resolves.toBeNull();
  });

  test('treats deleted or inaccessible threads as unavailable', async () => {
    const guild = {
      channels: {
        fetch: vi.fn<(id: string) => Promise<never>>(async () => {
          throw new Error('missing');
        }),
      },
    } as unknown as Guild;

    await expect(
      resolvePartnerThread(guild, 'message-id', 'parent-id'),
    ).resolves.toBeNull();
  });
});
