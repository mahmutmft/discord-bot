import {
  ActionRowBuilder,
  type APIEmbed,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  EmbedBuilder,
  type JSONEncodable,
  userMention,
} from 'discord.js';

import {
  PARTNER_COMPONENT_LEGACY_VERSION,
  PARTNER_COMPONENT_VERSION,
  PARTNER_INTERESTED_BUTTON_ID,
} from '../constants.js';

type PartnerComponentOptions = {
  courseKey: string;
  disabled?: boolean;
  needed: number | undefined;
  ownerId: string;
};

type PartnerListingEmbedOptions = {
  course: string;
  description: string;
  needed: number;
  ownerId: string;
};

const actionId = ({
  courseKey,
  name,
  needed,
  ownerId,
}: PartnerComponentOptions & { name: string }) =>
  needed === undefined
    ? `${name}:${PARTNER_COMPONENT_LEGACY_VERSION}:${ownerId}:${courseKey}`
    : `${name}:${PARTNER_COMPONENT_VERSION}:${ownerId}:${courseKey}:${needed}`;

export const getPartnerListingComponents = ({
  courseKey,
  disabled = false,
  needed,
  ownerId,
}: PartnerComponentOptions) =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(
        actionId({
          courseKey,
          name: PARTNER_INTERESTED_BUTTON_ID,
          needed,
          ownerId,
        }),
      )
      .setDisabled(disabled)
      .setLabel('Приклучи се во разговор')
      .setStyle(ButtonStyle.Success),
  );

export const getClosedPartnerListingEmbed = (
  embed: APIEmbed | JSONEncodable<APIEmbed>,
) =>
  EmbedBuilder.from(embed)
    .setColor(Colors.Greyple)
    .setTitle('Затворен оглас за тимски партнер')
    .setFooter({ text: 'Овој оглас повеќе не е активен.' });

export const getPartnerListingEmbed = ({
  course,
  description,
  needed,
  ownerId,
}: PartnerListingEmbedOptions) =>
  new EmbedBuilder()
    .setColor(Colors.Blurple)
    .setTitle('Оглас за тимски партнер')
    .setDescription(description)
    .addFields(
      { inline: true, name: 'Предмет', value: course },
      { inline: true, name: 'Автор', value: userMention(ownerId) },
      {
        inline: true,
        name: 'Потребни партнери',
        value: needed.toString(),
      },
    )
    .setFooter({
      text: 'Притисни „Приклучи се во разговор“ ако сакаш да учествуваш.',
    });
