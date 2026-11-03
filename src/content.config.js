import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

const experience = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/experience' }),
  schema: z.object({
    title: z.string(),
    role: z.string(),
    start: z.string().regex(MONTH_PATTERN, 'start must look like "2024-04"'),
    end: z.union([z.literal('heute'), z.string().regex(MONTH_PATTERN, 'end must be "heute" or look like "2025-09"')]),
    description: z.string(),
    projects: z.array(z.string()),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    category: z.string(),
    description: z.string(),
    image: z.string().optional(),
    imageAlt: z.string().optional(),
    technologies: z.array(z.string()),
    repo: z.string().url(),
    live: z.string().url().optional(),
    date: z.string().regex(MONTH_PATTERN, 'date must look like "2026-10"'),
  }),
});

// One file with the general data and the homepage texts. The links must be full addresses,
// a link without "https://" would be read as a path on this site.
const site = defineCollection({
  loader: glob({ pattern: 'site.md', base: './src/content/site' }),
  schema: z.object({
    name: z.string(),
    role: z.string(),
    email: z.string().email(),
    linkedin: z.string().url(),
    github: z.string().url(),
    established: z.string(),
    techNote: z.string(),
    home: z.object({
      metaDescription: z.string(),
      heroIntro: z.string(),
      heroMain: z.string(),
      photo: z.string().optional(),
      photoAlt: z.string(),
      aboutLabel: z.string(),
      about: z.string(),
      globeAlt: z.string(),
      globeHint: z.string(),
    }),
  }),
});

export const collections = { experience, projects, site };
