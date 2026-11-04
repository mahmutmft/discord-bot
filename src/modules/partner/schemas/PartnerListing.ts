import { z } from 'zod';

import {
  PARTNER_COMPONENT_LEGACY_VERSION,
  PARTNER_COMPONENT_VERSION,
  PARTNER_DESCRIPTION_MAX_LENGTH,
  PARTNER_DESCRIPTION_MIN_LENGTH,
  PARTNER_MAX_NEEDED,
  PARTNER_MIN_NEEDED,
} from '../constants.js';

export const PartnerListingInputSchema = z.object({
  course: z.string().trim().min(1),
  description: z
    .string()
    .trim()
    .min(PARTNER_DESCRIPTION_MIN_LENGTH)
    .max(PARTNER_DESCRIPTION_MAX_LENGTH),
  needed: z.number().int().min(PARTNER_MIN_NEEDED).max(PARTNER_MAX_NEEDED),
});

export type PartnerListingInput = z.infer<typeof PartnerListingInputSchema>;

const ownerIdSchema = z.string().regex(/^\d{17,20}$/u);
const courseKeySchema = z.string().regex(/^[\w-]{12}$/u);

export const PartnerActionArgumentsSchema = z.union([
  z.tuple([
    z.literal(PARTNER_COMPONENT_LEGACY_VERSION),
    ownerIdSchema,
    courseKeySchema,
  ]),
  z.tuple([
    z.literal(PARTNER_COMPONENT_VERSION),
    ownerIdSchema,
    courseKeySchema,
    z.coerce.number().int().min(PARTNER_MIN_NEEDED).max(PARTNER_MAX_NEEDED),
  ]),
]);

export type PartnerActionArguments = z.infer<
  typeof PartnerActionArgumentsSchema
>;
