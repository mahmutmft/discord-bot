import {
  type ActionRowBuilder,
  type ButtonBuilder,
  ChannelType,
  type ChatInputCommandInteraction,
  type EmbedBuilder,
  MessageFlags,
  ThreadAutoArchiveDuration,
} from 'discord.js';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { data, execute } from '@/modules/partner/commands/chat/partner.js';
import { partnerErrors, partnerMessages } from '@/translations/partner.js';

const mocks = vi.hoisted(() => ({
  canClosePartnerListing: vi.fn<() => Promise<boolean>>(),
  closePartnerListing: vi.fn<(options: unknown) => Promise<void>>(),
  getClosestCourse: vi.fn<(course: string) => null | string>(),
  getCourse: vi.fn<(course: string) => undefined | { name: string }>(),
  getMemberFromGuild: vi.fn<() => Promise<null | { id: string }>>(),
  getPartnerInterestedCustomId: vi.fn<() => null | string>(),
  hasActivePartnerListing:
    vi.fn<
      (channel: unknown, ownerId: string, courseKey: string) => Promise<boolean>
    >(),
  logger: {
    error: vi.fn<(message: string, metadata: unknown) => void>(),
  },
}));

vi.mock('@/common/logger/index.js', () => ({ logger: mocks.logger }));
vi.mock('@/common/utils/guild.js', () => ({
  getMemberFromGuild: mocks.getMemberFromGuild,
}));
vi.mock('@/modules/course/utils/data.js', () => ({
  getCourse: mocks.getCourse,
}));
vi.mock('@/modules/course/utils/search.js', () => ({
  getClosestCourse: mocks.getClosestCourse,
}));
vi.mock('@/modules/partner/utils/listings.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getPartnerInterestedCustomId: mocks.getPartnerInterestedCustomId,
  hasActivePartnerListing: mocks.hasActivePartnerListing,
}));
vi.mock('@/modules/partner/utils/closeListing.js', () => ({
  closePartnerListing: mocks.closePartnerListing,
}));
vi.mock('@/modules/partner/utils/permissions.js', () => ({
  canClosePartnerListing: mocks.canClosePartnerListing,
}));

const COURSE = 'Тимски проект';
const DESCRIPTION = 'Барам партнер заинтересиран за frontend развој.';
const OWNER_ID = '123456789012345678';
const COURSE_KEY_PATTERN = /^[\w-]{12}$/u;
const COURSE_KEY = 'Abcdef123456';
const INTERESTED_BUTTON_ID_PATTERN = /^partnerInterested:/u;

const createFixture = (overrides?: {
  channelType?: ChannelType;
  course?: null | string;
  description?: null | string;
  guild?: boolean;
  needed?: null | number;
  parentId?: null | string;
  subcommand?: 'close' | 'create';
  threadFailure?: boolean;
}) => {
  const addMember = vi.fn<(userId: string) => Promise<void>>(async () => {});
  const sendToThread = vi.fn<(payload: unknown) => Promise<void>>(
    async () => {},
  );
  const thread = {
    id: '223456789012345678',
    members: { add: addMember },
    send: sendToThread,
  };
  const startThread = overrides?.threadFailure
    ? vi.fn<(options: unknown) => Promise<typeof thread>>(async () => {
        throw new Error('Missing Permissions');
      })
    : vi.fn<(options: unknown) => Promise<typeof thread>>(async () => thread);
  const deleteListing = vi.fn<() => Promise<void>>(async () => {});
  const listingMessage = {
    delete: deleteListing,
    startThread,
  };
  const sendListing = vi.fn<
    (payload: unknown) => Promise<typeof listingMessage>
  >(async () => listingMessage);
  const channel = {
    id: '323456789012345678',
    parentId:
      overrides?.parentId === undefined
        ? '423456789012345678'
        : overrides.parentId,
    send: sendListing,
    type: overrides?.channelType ?? ChannelType.GuildText,
  };
  const deferReply = vi.fn<(payload: unknown) => Promise<void>>(async () => {});
  const editReply = vi.fn<(payload: unknown) => Promise<void>>(async () => {});
  const values = {
    course: overrides?.course === undefined ? COURSE : overrides.course,
    description:
      overrides?.description === undefined
        ? DESCRIPTION
        : overrides.description,
    partners: overrides?.needed === undefined ? 1 : overrides.needed,
  };
  const interaction = {
    channel,
    deferReply,
    editReply,
    guild: overrides?.guild === false ? null : { id: 'guild-id' },
    options: {
      getInteger: (name: keyof typeof values) => values[name],
      getString: (name: keyof typeof values) => values[name],
      getSubcommand: () => overrides?.subcommand ?? 'create',
    },
    user: {
      displayName: 'Student',
      id: OWNER_ID,
    },
  } as unknown as ChatInputCommandInteraction;

  return {
    addMember,
    channel,
    deferReply,
    deleteListing,
    editReply,
    interaction,
    sendListing,
    sendToThread,
    startThread,
  };
};

const createCloseFixture = (channelType = ChannelType.PublicThread) => {
  const listingMessage = { components: [] };
  const fetchStarterMessage = vi.fn<() => Promise<typeof listingMessage>>(
    async () => listingMessage,
  );
  const channel = {
    fetchStarterMessage,
    id: 'thread-id',
    parentId: 'parent-id',
    type: channelType,
  };
  const deferReply = vi.fn<(payload: unknown) => Promise<void>>(async () => {});
  const editReply = vi.fn<(payload: unknown) => Promise<void>>(async () => {});
  const guild = { id: 'guild-id' };
  const interaction = {
    channel,
    deferReply,
    editReply,
    guild,
    options: { getSubcommand: () => 'close' },
    user: { id: OWNER_ID },
  } as unknown as ChatInputCommandInteraction;

  return {
    channel,
    deferReply,
    editReply,
    fetchStarterMessage,
    guild,
    interaction,
    listingMessage,
  };
};

const resetPartnerCommandMocks = () => {
  vi.clearAllMocks();
  mocks.getClosestCourse.mockReturnValue(COURSE);
  mocks.getCourse.mockReturnValue({ name: COURSE });
  mocks.hasActivePartnerListing.mockResolvedValue(false);
  mocks.getMemberFromGuild.mockResolvedValue({ id: OWNER_ID });
  mocks.getPartnerInterestedCustomId.mockReturnValue(
    `partnerInterested:v2:${OWNER_ID}:${COURSE_KEY}:1`,
  );
  mocks.canClosePartnerListing.mockResolvedValue(true);
  mocks.closePartnerListing.mockResolvedValue();
};

describe('/partner create', () => {
  beforeEach(resetPartnerCommandMocks);

  test('registers bounded and autocomplete-enabled options', () => {
    const command = data.toJSON();
    const create = command.options?.[0];

    expect(create).toMatchObject({ name: 'post' });
    expect(create && 'options' in create ? create.options : []).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          autocomplete: true,
          name: 'course',
          required: true,
        }),
        expect.objectContaining({
          description: 'Колку тимски партнери бараш? (1-5)',
          max_value: 5,
          min_value: 1,
          name: 'partners',
          required: true,
        }),
        expect.objectContaining({
          max_length: 500,
          min_length: 20,
          name: 'description',
          required: true,
        }),
      ]),
    );
  });

  test('registers a thread-only close subcommand', () => {
    const close = data
      .toJSON()
      .options?.find((option) => option.name === 'close');

    expect(close).toMatchObject({
      description: 'Затвори го активниот оглас во оваа нишка',
      name: 'close',
    });
  });

  test('creates a safe listing and a public discussion thread', async () => {
    const fixture = createFixture();

    await execute(fixture.interaction);

    expect(fixture.deferReply).toHaveBeenCalledWith({
      flags: MessageFlags.Ephemeral,
    });
    expect(mocks.hasActivePartnerListing).toHaveBeenCalledWith(
      fixture.channel,
      OWNER_ID,
      expect.stringMatching(COURSE_KEY_PATTERN),
    );
    expect(fixture.sendListing).toHaveBeenCalledWith(
      expect.objectContaining({
        allowedMentions: { parse: [] },
        components: [expect.anything()],
        embeds: [expect.anything()],
      }),
    );
    const listingPayload = fixture.sendListing.mock.calls[0]?.[0] as
      | undefined
      | {
          components: Array<ActionRowBuilder<ButtonBuilder>>;
          embeds: EmbedBuilder[];
        };
    const embed = listingPayload?.embeds[0]?.toJSON();
    const buttons = listingPayload?.components[0]?.toJSON().components ?? [];
    const interestedButton = buttons[0] as
      undefined | { custom_id?: string; label?: string };
    expect(buttons).toHaveLength(1);
    expect(interestedButton?.custom_id).toMatch(INTERESTED_BUTTON_ID_PATTERN);
    expect(interestedButton?.label).toBe('Приклучи се во разговор');
    expect(embed?.title).toBe('Оглас за тимски партнер');
    expect(embed?.description).toBe(DESCRIPTION);
    expect(embed?.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Предмет', value: COURSE }),
        expect.objectContaining({ name: 'Автор', value: `<@${OWNER_ID}>` }),
        expect.objectContaining({ name: 'Потребни партнери', value: '1' }),
      ]),
    );
    const threadOptions = fixture.startThread.mock.calls[0]?.[0] as
      undefined | { autoArchiveDuration: number; name: string };
    expect(threadOptions?.autoArchiveDuration).toBe(
      ThreadAutoArchiveDuration.OneWeek,
    );
    expect(threadOptions?.name).toContain(COURSE);
    expect(fixture.addMember).toHaveBeenCalledWith(OWNER_ID);
    expect(fixture.sendToThread).toHaveBeenCalledWith({
      allowedMentions: { parse: [] },
      content: partnerMessages.threadWelcome,
    });
    expect(fixture.editReply).toHaveBeenCalledWith(
      expect.stringContaining('<#223456789012345678>'),
    );
  });

  test.each([
    { description: 'too short', label: 'short description' },
    { description: 'a'.repeat(501), label: 'long description' },
    { label: 'negative teammates', needed: -1 },
    { label: 'zero teammates', needed: 0 },
    { label: 'too many teammates', needed: 6 },
    { label: 'decimal teammates', needed: 1.5 },
  ])('rejects $label', async (overrides) => {
    const fixture = createFixture(overrides);

    await execute(fixture.interaction);

    expect(fixture.editReply).toHaveBeenCalledWith(
      partnerErrors.invalidOptions,
    );
    expect(fixture.sendListing).not.toHaveBeenCalled();
  });

  test('accepts a 500-character Macedonian description boundary', async () => {
    const description = 'а'.repeat(500);
    const fixture = createFixture({ description });

    await execute(fixture.interaction);

    const listingPayload = fixture.sendListing.mock.calls[0]?.[0] as
      undefined | { embeds: EmbedBuilder[] };
    expect(listingPayload?.embeds[0]?.toJSON().description).toBe(description);
    expect(fixture.editReply).toHaveBeenCalledWith(
      expect.stringContaining('<#223456789012345678>'),
    );
  });

  test.each([
    { guild: false, label: 'direct messages' },
    { label: 'channels without a category', parentId: null },
    { channelType: ChannelType.GuildVoice, label: 'non-text channels' },
  ])('rejects $label', async (overrides) => {
    const fixture = createFixture(overrides);

    await execute(fixture.interaction);

    expect(fixture.editReply).toHaveBeenCalledWith(
      partnerErrors.invalidChannel,
    );
    expect(fixture.sendListing).not.toHaveBeenCalled();
  });

  test('rejects unknown courses', async () => {
    mocks.getClosestCourse.mockReturnValue(null);
    const fixture = createFixture();

    await execute(fixture.interaction);

    expect(fixture.editReply).toHaveBeenCalledWith(
      partnerErrors.courseNotFound,
    );
    expect(fixture.sendListing).not.toHaveBeenCalled();
  });

  test('rejects a duplicate active listing', async () => {
    mocks.hasActivePartnerListing.mockResolvedValue(true);
    const fixture = createFixture();

    await execute(fixture.interaction);

    expect(fixture.editReply).toHaveBeenCalledWith(
      partnerErrors.activeListingExists,
    );
    expect(fixture.sendListing).not.toHaveBeenCalled();
  });

  test('removes a partial listing when thread creation fails', async () => {
    const fixture = createFixture({ threadFailure: true });

    await execute(fixture.interaction);

    expect(fixture.deleteListing).toHaveBeenCalledOnce();
    expect(fixture.editReply).toHaveBeenCalledWith(
      partnerErrors.listingCreationFailed,
    );
    expect(mocks.logger.error).toHaveBeenCalledWith(
      'Failed creating partner listing (error)',
      { guildId: 'guild-id' },
    );
  });
});

describe('/partner close', () => {
  beforeEach(resetPartnerCommandMocks);

  test('closes a listing from its thread for the owner', async () => {
    const fixture = createCloseFixture();

    await execute(fixture.interaction);

    expect(fixture.deferReply).toHaveBeenCalledWith({
      flags: MessageFlags.Ephemeral,
    });
    expect(mocks.canClosePartnerListing).toHaveBeenCalledWith(
      { id: OWNER_ID },
      OWNER_ID,
      fixture.guild,
    );
    expect(mocks.closePartnerListing).toHaveBeenCalledWith({
      courseKey: COURSE_KEY,
      listingMessage: fixture.listingMessage,
      needed: 1,
      ownerId: OWNER_ID,
      thread: fixture.channel,
    });
    expect(fixture.editReply).toHaveBeenCalledWith(
      partnerMessages.listingClosed,
    );
  });

  test('rejects close attempts by other students', async () => {
    mocks.canClosePartnerListing.mockResolvedValue(false);
    const fixture = createCloseFixture();

    await execute(fixture.interaction);

    expect(fixture.editReply).toHaveBeenCalledWith(
      partnerErrors.listingNoPermission,
    );
    expect(mocks.closePartnerListing).not.toHaveBeenCalled();
  });

  test('rejects close in a thread that is not a partner listing', async () => {
    mocks.getPartnerInterestedCustomId.mockReturnValue(null);
    const fixture = createCloseFixture();

    await execute(fixture.interaction);

    expect(fixture.editReply).toHaveBeenCalledWith(
      partnerErrors.invalidListing,
    );
    expect(mocks.canClosePartnerListing).not.toHaveBeenCalled();
    expect(mocks.closePartnerListing).not.toHaveBeenCalled();
  });

  test('rejects close outside a listing thread', async () => {
    const fixture = createCloseFixture(ChannelType.GuildText);

    await execute(fixture.interaction);

    expect(fixture.editReply).toHaveBeenCalledWith(
      partnerErrors.closeInvalidChannel,
    );
    expect(fixture.fetchStarterMessage).not.toHaveBeenCalled();
    expect(mocks.closePartnerListing).not.toHaveBeenCalled();
  });
});
