import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  userMention,
} from 'discord.js';

import {
  PARTNER_CLOSE_BUTTON_ID,
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
      .setLabel('Заинтересиран/а сум')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(actionId(PARTNER_CLOSE_BUTTON_ID, ownerId, courseKey))
      .setDisabled(disabled)
      .setLabel('Затвори оглас')
      .setStyle(ButtonStyle.Danger),
  );

export const getPartnerListingEmbed = ({
  course,
  description,
  needed,
  ownerId,
}: PartnerListingEmbedOptions) =>
  new EmbedBuilder()
    .setTitle('🤝 Се бара тимски партнер')
    .setDescription(description)
    .addFields(
      { inline: true, name: 'Предмет', value: course },
      { inline: true, name: 'Студент', value: userMention(ownerId) },
      {
        inline: true,
        name: 'Потребни членови',
        value: needed.toString(),
      },
    )
    .setFooter({
      text: 'Притисни „Заинтересиран/а сум“ за да се приклучиш во разговорот.',
    });
