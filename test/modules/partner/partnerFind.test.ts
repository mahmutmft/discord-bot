import type { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';

import { expect, test, vi } from 'vitest';

import { findPartnerListings } from '@/modules/partner/utils/findListings.js';
import { getPartnerCourseKey } from '@/modules/partner/utils/listings.js';

vi.mock('@/modules/course/utils/search.js', () => ({
  getClosestCourse: () => 'Course',
}));
vi.mock('@/modules/course/utils/data.js', () => ({
  getCourse: () => ({ name: 'Course' }),
}));

test('find returns only visible matching listings with available places', async () => {
  const owner = '123456789012345678';
  const student = '223456789012345678';
  const key = getPartnerCourseKey('Course');
  const makeThread = (id: string, visible: boolean, full: boolean) => ({
    archived: false,
    fetchStarterMessage: async () => ({
      author: { id: 'bot' },
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              customId: `partnerInterested:v2:${owner}:${id === '4' ? 'Different123' : key}:1`,
            },
          ],
        },
      ],
      embeds: [{ description: `Listing ${id}` }],
      url: `https://discord.com/channels/g/c/${id}`,
    }),
    id,
    locked: false,
    members: { fetch: async () => new Map(full ? [[student, {}]] : []) },
    permissionsFor: () => ({ has: () => visible }),
  });
  const editReply = vi.fn<
    (payload: { embeds: EmbedBuilder[] }) => Promise<void>
  >(async () => {});
  const interaction = {
    client: { user: { id: 'bot' } },
    editReply,
    guild: {
      channels: {
        fetchActiveThreads: async () => ({
          threads: new Map([
            ['1', makeThread('1', true, false)],
            ['2', makeThread('2', true, true)],
            ['3', makeThread('3', false, false)],
            ['4', makeThread('4', true, false)],
          ]),
        }),
      },
    },
    options: { getInteger: () => 1, getString: () => 'Course' },
    user: { id: student },
  } as unknown as ChatInputCommandInteraction;

  await findPartnerListings(interaction);

  const description =
    editReply.mock.calls[0]?.[0].embeds[0]?.toJSON().description;
  expect(description).toContain('Listing 1');
  expect(description).not.toContain('Listing 2');
  expect(description).not.toContain('Listing 3');
  expect(description).not.toContain('Listing 4');
});
