import {
  type ActionRowBuilder,
  type ButtonBuilder,
  type ButtonInteraction,
} from 'discord.js';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { execute as closeListing } from '@/modules/partner/commands/button/partnerClose.js';
import { execute as expressInterest } from '@/modules/partner/commands/button/partnerInterested.js';
import { partnerErrors, partnerMessages } from '@/translations/partner.js';

const mocks = vi.hoisted(() => ({
  canClosePartnerListing:
    vi.fn<
      (member: unknown, ownerId: string, guild: unknown) => Promise<boolean>
    >(),
  getMemberFromGuild:
    vi.fn<(userId: string, guild: unknown) => Promise<null | { id: string }>>(),
  resolvePartnerThread:
    vi.fn<
      (
        guild: unknown,
        messageId: string,
        parentChannelId: string,
      ) => Promise<unknown>
    >(),
}));

vi.mock('@/common/utils/guild.js', () => ({
  getMemberFromGuild: mocks.getMemberFromGuild,
}));
vi.mock('@/modules/partner/utils/listings.js', () => ({
  resolvePartnerThread: mocks.resolvePartnerThread,
}));
vi.mock('@/modules/partner/utils/permissions.js', () => ({
  canClosePartnerListing: mocks.canClosePartnerListing,
}));

const COURSE_KEY = 'Abcdef123456';
const BOT_ID = '999999999999999999';
const OWNER_ID = '123456789012345678';
const STUDENT_ID = '223456789012345678';
const SECOND_STUDENT_ID = '323456789012345678';
const VALID_ARGS = ['v2', OWNER_ID, COURSE_KEY, '1'];

const createFixture = (userId = STUDENT_ID) => {
  const editMessage = vi.fn<(payload: unknown) => Promise<void>>(
    async () => {},
  );
  const editReply = vi.fn<(payload: unknown) => Promise<void>>(async () => {});
  const addMember = vi.fn<(userId: string) => Promise<void>>(async () => {});
  const fetchMembers = vi.fn<() => Promise<Map<string, unknown>>>(
    async () => new Map(),
  );
  const setArchived = vi.fn<
    (archived: boolean, reason?: string) => Promise<void>
  >(async () => {});
  const setLocked = vi.fn<(locked: boolean, reason?: string) => Promise<void>>(
    async () => {},
  );
  const guild = { id: 'guild-id' };
  const interaction = {
    client: { user: { id: BOT_ID } },
    editReply,
    guild,
    message: {
      channelId: '323456789012345678',
      edit: editMessage,
      embeds: [],
      id: '423456789012345678',
    },
    user: { id: userId },
  } as unknown as ButtonInteraction;
  const thread = {
    archived: false,
    id: '423456789012345678',
    locked: false,
    members: {
      add: addMember,
      fetch: fetchMembers,
    },
    setArchived,
    setLocked,
  };

  return {
    addMember,
    editMessage,
    editReply,
    fetchMembers,
    guild,
    interaction,
    setArchived,
    setLocked,
    thread,
  };
};

const resetButtonMocks = () => {
  vi.clearAllMocks();
  mocks.getMemberFromGuild.mockResolvedValue({ id: STUDENT_ID });
  mocks.canClosePartnerListing.mockResolvedValue(true);
};

describe('partner interest button', () => {
  beforeEach(resetButtonMocks);

  test('adds an interested student to the persistent thread', async () => {
    const fixture = createFixture();
    mocks.resolvePartnerThread.mockResolvedValue(fixture.thread);

    await expressInterest(fixture.interaction, VALID_ARGS);

    expect(mocks.resolvePartnerThread).toHaveBeenCalledWith(
      fixture.guild,
      '423456789012345678',
      '323456789012345678',
    );
    expect(fixture.addMember).toHaveBeenCalledWith(STUDENT_ID);
    expect(fixture.editMessage).toHaveBeenCalledWith({
      components: [expect.anything()],
    });
    expect(fixture.editReply).toHaveBeenCalledWith(
      expect.stringContaining('<#423456789012345678>'),
    );
  });

  test('rejects self-interest', async () => {
    const fixture = createFixture(OWNER_ID);

    await expressInterest(fixture.interaction, VALID_ARGS);

    expect(fixture.editReply).toHaveBeenCalledWith(
      partnerErrors.cannotJoinOwnListing,
    );
    expect(mocks.resolvePartnerThread).not.toHaveBeenCalled();
  });

  test('keeps duplicate interest idempotent', async () => {
    const fixture = createFixture();
    fixture.fetchMembers.mockResolvedValue(
      new Map([[STUDENT_ID, { id: STUDENT_ID }]]),
    );
    mocks.resolvePartnerThread.mockResolvedValue(fixture.thread);

    await expressInterest(fixture.interaction, VALID_ARGS);

    expect(fixture.addMember).not.toHaveBeenCalled();
    expect(fixture.editReply).toHaveBeenCalledWith(
      partnerMessages.alreadyInterested,
    );
  });

  test('rejects interest after the requested capacity is full', async () => {
    const fixture = createFixture();
    fixture.fetchMembers.mockResolvedValue(
      new Map([[SECOND_STUDENT_ID, { id: SECOND_STUDENT_ID }]]),
    );
    mocks.resolvePartnerThread.mockResolvedValue(fixture.thread);

    await expressInterest(fixture.interaction, VALID_ARGS);

    expect(fixture.addMember).not.toHaveBeenCalled();
    expect(fixture.editMessage).toHaveBeenCalledWith({
      components: [expect.anything()],
    });
    expect(fixture.editReply).toHaveBeenCalledWith(partnerErrors.listingFull);
  });

  test('excludes the owner and bot when counting occupied places', async () => {
    const fixture = createFixture();
    fixture.fetchMembers.mockResolvedValue(
      new Map([
        [BOT_ID, { id: BOT_ID }],
        [OWNER_ID, { id: OWNER_ID }],
      ]),
    );
    mocks.resolvePartnerThread.mockResolvedValue(fixture.thread);

    await expressInterest(fixture.interaction, VALID_ARGS);

    expect(fixture.addMember).toHaveBeenCalledWith(STUDENT_ID);
    expect(fixture.editReply).toHaveBeenCalledWith(
      expect.stringContaining('<#423456789012345678>'),
    );
  });

  test('allows only one winner for the last place under concurrent clicks', async () => {
    const first = createFixture(STUDENT_ID);
    const second = createFixture(SECOND_STUDENT_ID);
    const members = new Map<string, unknown>();
    const addMember = vi.fn<(userId: string) => Promise<void>>(
      async (userId) => {
        await Promise.resolve();
        members.set(userId, { id: userId });
      },
    );
    const sharedThread = {
      ...first.thread,
      members: {
        add: addMember,
        fetch: async () => new Map(members),
      },
    };
    mocks.resolvePartnerThread.mockResolvedValue(sharedThread);

    await Promise.all([
      expressInterest(first.interaction, VALID_ARGS),
      expressInterest(second.interaction, VALID_ARGS),
    ]);

    expect(addMember).toHaveBeenCalledOnce();
    const replies = [
      ...first.editReply.mock.calls,
      ...second.editReply.mock.calls,
    ].map(([message]) => message);
    expect(replies).toContain(partnerErrors.listingFull);
    expect(
      replies.some(
        (message) =>
          typeof message === 'string' &&
          message.includes('<#423456789012345678>'),
      ),
    ).toBe(true);
  });

  test.each([
    { archived: true, label: 'archived' },
    { label: 'locked', locked: true },
  ])('disables controls for an $label listing', async (state) => {
    const fixture = createFixture();
    mocks.resolvePartnerThread.mockResolvedValue({
      ...fixture.thread,
      ...state,
    });

    await expressInterest(fixture.interaction, VALID_ARGS);

    expect(fixture.editMessage).toHaveBeenCalledWith({
      components: [expect.anything()],
    });
    const editPayload = fixture.editMessage.mock.calls[0]?.[0] as
      undefined | { components: Array<ActionRowBuilder<ButtonBuilder>> };
    const buttons = editPayload?.components[0]?.toJSON().components ?? [];
    expect(
      buttons.every((button: { disabled?: boolean }) => button.disabled),
    ).toBe(true);
    expect(fixture.editReply).toHaveBeenCalledWith(
      partnerErrors.invalidListing,
    );
  });

  test('rejects malformed interest metadata', async () => {
    const fixture = createFixture();

    await expressInterest(fixture.interaction, ['broken']);

    expect(fixture.editReply).toHaveBeenCalledWith(
      partnerErrors.invalidListing,
    );
  });
});

describe('partner close action', () => {
  beforeEach(resetButtonMocks);

  test('closes and disables a listing for an authorized member', async () => {
    const fixture = createFixture();
    mocks.getMemberFromGuild.mockResolvedValue({ id: OWNER_ID });
    mocks.resolvePartnerThread.mockResolvedValue(fixture.thread);

    await closeListing(fixture.interaction, VALID_ARGS);

    expect(mocks.canClosePartnerListing).toHaveBeenCalledWith(
      { id: OWNER_ID },
      OWNER_ID,
      fixture.guild,
    );
    expect(fixture.setLocked).toHaveBeenCalledWith(
      true,
      'Partner finder listing closed',
    );
    expect(fixture.setArchived).toHaveBeenCalledWith(
      true,
      'Partner finder listing closed',
    );
    expect(fixture.editMessage).toHaveBeenCalledWith({
      components: [expect.anything()],
    });
    expect(fixture.editReply).toHaveBeenCalledWith(
      partnerMessages.listingClosed,
    );
  });

  test('makes repeated close actions idempotent and repairs the controls', async () => {
    const fixture = createFixture();
    mocks.resolvePartnerThread.mockResolvedValue({
      ...fixture.thread,
      archived: true,
      locked: true,
    });

    await closeListing(fixture.interaction, VALID_ARGS);

    expect(fixture.setLocked).not.toHaveBeenCalled();
    expect(fixture.setArchived).not.toHaveBeenCalled();
    expect(fixture.editMessage).toHaveBeenCalledWith({
      components: [expect.anything()],
    });
    expect(fixture.editReply).toHaveBeenCalledWith(
      partnerMessages.listingClosed,
    );
  });

  test('does not report success when Discord rejects the close', async () => {
    const fixture = createFixture();
    fixture.setLocked.mockRejectedValue(new Error('Missing Permissions'));
    mocks.resolvePartnerThread.mockResolvedValue(fixture.thread);

    await expect(closeListing(fixture.interaction, VALID_ARGS)).rejects.toThrow(
      'Missing Permissions',
    );

    expect(fixture.setArchived).not.toHaveBeenCalled();
    expect(fixture.editMessage).not.toHaveBeenCalled();
    expect(fixture.editReply).not.toHaveBeenCalledWith(
      partnerMessages.listingClosed,
    );
  });

  test('rejects an unauthorized close', async () => {
    const fixture = createFixture();
    mocks.canClosePartnerListing.mockResolvedValue(false);

    await closeListing(fixture.interaction, VALID_ARGS);

    expect(fixture.editReply).toHaveBeenCalledWith(
      partnerErrors.listingNoPermission,
    );
    expect(mocks.resolvePartnerThread).not.toHaveBeenCalled();
  });

  test('rejects a missing listing thread', async () => {
    const fixture = createFixture();
    mocks.resolvePartnerThread.mockResolvedValue(null);

    await closeListing(fixture.interaction, VALID_ARGS);

    expect(fixture.editReply).toHaveBeenCalledWith(
      partnerErrors.invalidListing,
    );
  });
});
