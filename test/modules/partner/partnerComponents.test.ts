import { Colors, EmbedBuilder } from 'discord.js';
import { describe, expect, test } from 'vitest';

import {
  getClosedPartnerListingEmbed,
  getPartnerListingEmbed,
} from '@/modules/partner/components/components.js';

describe('partner listing presentation', () => {
  test('uses a clean active state without decorative emoji', () => {
    const embed = getPartnerListingEmbed({
      course: 'Веб програмирање',
      description: 'Барам партнер за изработка на React апликација.',
      needed: 1,
      ownerId: '123456789012345678',
    }).toJSON();

    expect(embed).toMatchObject({
      color: Colors.Blurple,
      title: 'Оглас за тимски партнер',
    });
    expect(JSON.stringify(embed)).not.toContain('🤝');
  });

  test('makes the closed state explicit and neutral', () => {
    const active = new EmbedBuilder()
      .setTitle('Оглас за тимски партнер')
      .setDescription('Опис')
      .setColor(Colors.Blurple);
    const closed = getClosedPartnerListingEmbed(active).toJSON();

    expect(closed).toMatchObject({
      color: Colors.Greyple,
      description: 'Опис',
      footer: { text: 'Овој оглас повеќе не е активен.' },
      title: 'Затворен оглас за тимски партнер',
    });
  });
});
