import { type AutocompleteInteraction } from 'discord.js';

import { execute as executeCourseAutocomplete } from '@/modules/course/commands/autocomplete/course.js';

export const name = 'partner';

export const execute = (interaction: AutocompleteInteraction) =>
  executeCourseAutocomplete(interaction);
