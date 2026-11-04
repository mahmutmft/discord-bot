import {
  ChannelType,
  type ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
  ThreadAutoArchiveDuration,
} from 'discord.js';

import { logger } from '@/common/logger/index.js';
import { getMemberFromGuild } from '@/common/utils/guild.js';
import { errorCategory } from '@/common/utils/safeError.js';
import { getCourse } from '@/modules/course/utils/data.js';
import { getClosestCourse } from '@/modules/course/utils/search.js';
import {
  getPartnerListingComponents,
  getPartnerListingEmbed,
} from '@/modules/partner/components/components.js';
import {
  PARTNER_DESCRIPTION_MAX_LENGTH,
  PARTNER_DESCRIPTION_MIN_LENGTH,
  PARTNER_MAX_NEEDED,
  PARTNER_MIN_NEEDED,
} from '@/modules/partner/constants.js';
import {
  PartnerActionArgumentsSchema,
  PartnerListingInputSchema,
} from '@/modules/partner/schemas/PartnerListing.js';
import { closePartnerListing } from '@/modules/partner/utils/closeListing.js';
import {
  getPartnerCourseKey,
  getPartnerInterestedCustomId,
  hasActivePartnerListing,
} from '@/modules/partner/utils/listings.js';
import { canClosePartnerListing } from '@/modules/partner/utils/permissions.js';
import {
  partnerErrors,
  partnerMessageFunctions,
  partnerMessages,
} from '@/translations/partner.js';

export const name = 'partner';

export const data = new SlashCommandBuilder()
  .setName(name)
  .setDescription('Најди тимски партнер за проект')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('create')
      .setDescription('Креирај оглас за тимски партнер')
      .addStringOption((option) =>
        option
          .setName('course')
          .setDescription('Предмет')
          .setRequired(true)
          .setAutocomplete(true),
      )
      .addIntegerOption((option) =>
        option
          .setName('partners')
          .setDescription('Колку тимски партнери бараш? (1-5)')
          .setRequired(true)
          .setMinValue(PARTNER_MIN_NEEDED)
          .setMaxValue(PARTNER_MAX_NEEDED),
      )
      .addStringOption((option) =>
        option
          .setName('description')
          .setDescription('Краток опис за проектот и очекувањата')
          .setRequired(true)
          .setMinLength(PARTNER_DESCRIPTION_MIN_LENGTH)
          .setMaxLength(PARTNER_DESCRIPTION_MAX_LENGTH),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('close')
      .setDescription('Затвори го активниот оглас во оваа нишка'),
  );

const threadName = (course: string, displayName: string) =>
  `🤝 ${course} — ${displayName}`.slice(0, 100);

const executeCreate = async (interaction: ChatInputCommandInteraction) => {
  const parsed = PartnerListingInputSchema.safeParse({
    course: interaction.options.getString('course'),
    description: interaction.options.getString('description'),
    needed: interaction.options.getInteger('partners'),
  });

  if (!parsed.success) {
    await interaction.editReply(partnerErrors.invalidOptions);
    return;
  }

  const { channel, guild, user } = interaction;

  if (
    guild === null ||
    channel?.type !== ChannelType.GuildText ||
    channel.parentId === null
  ) {
    await interaction.editReply(partnerErrors.invalidChannel);
    return;
  }

  const closestCourse = getClosestCourse(parsed.data.course);
  const course = closestCourse === null ? undefined : getCourse(closestCourse);

  if (course === undefined) {
    await interaction.editReply(partnerErrors.courseNotFound);
    return;
  }

  const courseKey = getPartnerCourseKey(course.name);

  if (await hasActivePartnerListing(channel, user.id, courseKey)) {
    await interaction.editReply(partnerErrors.activeListingExists);
    return;
  }

  let listingMessage;
  try {
    listingMessage = await channel.send({
      allowedMentions: { parse: [] },
      components: [
        getPartnerListingComponents({ courseKey, ownerId: user.id }),
      ],
      embeds: [
        getPartnerListingEmbed({
          course: course.name,
          description: parsed.data.description,
          needed: parsed.data.needed,
          ownerId: user.id,
        }),
      ],
    });

    const thread = await listingMessage.startThread({
      autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
      name: threadName(course.name, user.displayName),
      reason: 'Partner finder listing',
    });

    await thread.members.add(user.id);
    await thread.send({
      allowedMentions: { parse: [] },
      content: partnerMessages.threadWelcome,
    });

    await interaction.editReply(
      partnerMessageFunctions.listingCreated(thread.id),
    );
  } catch (error) {
    logger.error(`Failed creating partner listing (${errorCategory(error)})`, {
      guildId: guild.id,
    });

    try {
      await listingMessage?.delete();
    } catch {
      // Cleanup is best-effort; the command still reports the creation failure.
    }

    await interaction.editReply(partnerErrors.listingCreationFailed);
  }
};

const executeClose = async (interaction: ChatInputCommandInteraction) => {
  const { channel, guild } = interaction;

  if (
    guild === null ||
    channel?.type !== ChannelType.PublicThread ||
    channel.parentId === null
  ) {
    await interaction.editReply(partnerErrors.closeInvalidChannel);
    return;
  }

  let listingMessage;
  try {
    listingMessage = await channel.fetchStarterMessage();
  } catch {
    listingMessage = null;
  }

  const customId =
    listingMessage === null
      ? null
      : getPartnerInterestedCustomId(listingMessage);
  const parsed = PartnerActionArgumentsSchema.safeParse(
    customId?.split(':').slice(1),
  );

  if (listingMessage === null || !parsed.success) {
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

  await closePartnerListing({
    courseKey,
    listingMessage,
    ownerId,
    thread: channel,
  });
  await interaction.editReply(partnerMessages.listingClosed);
};

export const execute = async (interaction: ChatInputCommandInteraction) => {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (interaction.options.getSubcommand() === 'close') {
    await executeClose(interaction);
    return;
  }

  await executeCreate(interaction);
};
