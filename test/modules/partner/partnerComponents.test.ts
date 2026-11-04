import { Colors, EmbedBuilder } from 'discord.js';
import { describe, expect, test } from 'vitest';

import {
  getClosedPartnerListingEmbed,
  getPartnerListingComponents,
  getPartnerListingEmbed,
} from '@/modules/partner/components/components.js';
import { PartnerActionArgumentsSchema } from '@/modules/partner/schemas/PartnerListing.js';

describe('partner listing presentation', () => {
  test('persists requested capacity in versioned component metadata', () => {
    const row = getPartnerListingComponents({
      courseKey: 'Abcdef123456',
      needed: 2,
      ownerId: '123456789012345678',
    }).toJSON();
    const component = row.components[0] as undefined | { custom_id?: string };
    const customId = component?.custom_id;

    expect(customId).toBe(
      'partnerInterested:v2:123456789012345678:Abcdef123456:2',
    );
    expect(customId).toBeDefined();
    const args = customId?.split(':').slice(1);
    expect(PartnerActionArgumentsSchema.parse(args)).toEqual([
      'v2',
      '123456789012345678',
      'Abcdef123456',
      2,
    ]);
  });

  test('keeps legacy component metadata readable', () => {
    expect(
      PartnerActionArgumentsSchema.parse([
        'v1',
        '123456789012345678',
        'Abcdef123456',
      ]),
    ).toEqual(['v1', '123456789012345678', 'Abcdef123456']);
  });

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
