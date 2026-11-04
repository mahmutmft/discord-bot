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
  PARTNER_COMPONENT_VERSION,
  PARTNER_INTERESTED_BUTTON_ID,
} from '../constants.js';

type PartnerComponentOptions = {
  courseKey: string;
  disabled?: boolean;
  ownerId: string;
};

type PartnerListingEmbedOptions = {
  course: string;
  description: string;
  needed: number;
  ownerId: string;
};

const actionId = (name: string, ownerId: string, courseKey: string) =>
  `${name}:${PARTNER_COMPONENT_VERSION}:${ownerId}:${courseKey}`;

export const getPartnerListingComponents = ({
  courseKey,
  disabled = false,
  ownerId,
}: PartnerComponentOptions) =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(actionId(PARTNER_INTERESTED_BUTTON_ID, ownerId, courseKey))
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
