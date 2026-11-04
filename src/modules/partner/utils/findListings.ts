import {
  type ChatInputCommandInteraction,
  EmbedBuilder,
  type ThreadChannel,
} from 'discord.js';

import { getCourse } from '@/modules/course/utils/data.js';
import { getClosestCourse } from '@/modules/course/utils/search.js';
import { PartnerActionArgumentsSchema } from '@/modules/partner/schemas/PartnerListing.js';
import {
  getPartnerCourseKey,
  getPartnerInterestedCustomId,
} from '@/modules/partner/utils/listings.js';
import { partnerErrors } from '@/translations/partner.js';

const readListing = async (
  thread: ThreadChannel,
  interaction: ChatInputCommandInteraction,
  courseKey: string,
) => {
  if (
    thread.locked ||
    thread.archived ||
    !thread.permissionsFor(interaction.user)?.has('ViewChannel')
  )
    return null;
  const message = await thread.fetchStarterMessage();
  if (message?.author.id !== interaction.client.user.id) return null;
  const parsed = PartnerActionArgumentsSchema.safeParse(
    getPartnerInterestedCustomId(message)?.split(':').slice(1),
  );
  if (!parsed.success || parsed.data[2] !== courseKey) return null;
  const [, ownerId, , needed] = parsed.data;
  if (needed === undefined) return null;
  const members = await thread.members.fetch();
  let occupied = 0;
  for (const id of members.keys()) {
    if (id !== ownerId && id !== interaction.client.user.id) occupied += 1;
  }
  if (occupied >= needed) return null;
  return {
    description: `<@${ownerId}> · Слободни места: ${needed - occupied}\n${(message.embeds[0]?.description ?? '').slice(0, 500)}\n[Види оглас](${message.url})`,
    id: thread.id,
  };
};

export const findPartnerListings = async (
  interaction: ChatInputCommandInteraction,
) => {
  const { guild } = interaction;
  if (guild === null) {
    await interaction.editReply(partnerErrors.invalidChannel);
    return;
  }
  const input = interaction.options.getString('course', true);
  const closest = getClosestCourse(input);
  const course = closest === null ? undefined : getCourse(closest);
  if (course === undefined) {
    await interaction.editReply(partnerErrors.courseNotFound);
    return;
  }
  const courseKey = getPartnerCourseKey(course.name);
  const { threads } = await guild.channels.fetchActiveThreads();
  const results: Array<{ description: string; id: string }> = [];
  for (const thread of threads.values()) {
    try {
      const result = await readListing(thread, interaction, courseKey);
      if (result !== null) results.push(result);
    } catch {
      // Deleted or inaccessible listings are omitted from discovery.
    }
  }
  results.sort((a, b) => Number(BigInt(b.id) - BigInt(a.id)));
  const pages = Math.max(1, Math.ceil(results.length / 5));
  const page = Math.min(interaction.options.getInteger('page') ?? 1, pages);
  const embed = new EmbedBuilder()
    .setTitle(course.name)
    .setDescription(
      results.length === 0
        ? 'Нема активни огласи со слободни места за овој предмет. Користи /partner post за да објавиш оглас.'
        : results
            .slice((page - 1) * 5, page * 5)
            .map((result) => result.description)
            .join('\n\n'),
    )
    .setFooter({
      text: `Страница ${page}/${pages} · Активни огласи: ${results.length}`,
    });
  await interaction.editReply({
    allowedMentions: { parse: [] },
    embeds: [embed],
  });
};
