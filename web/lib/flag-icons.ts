import {
  WORLDCUP_TEAMS,
  type WorldCupTeam,
} from './worldcup-seed';

export const FLAG_ICON_CODE_BY_TEAM = Object.fromEntries(
  WORLDCUP_TEAMS.map((team) => [team.id, team.flagCode]),
) as Record<WorldCupTeam['id'], string>;

export const FLAG_ICON_BUNDLE_ALLOWLIST = [
  'qa',
  'ec',
  'sn',
  'nl',
  'gb-eng',
  'ir',
  'us',
  'gb-wls',
  'ar',
  'sa',
  'mx',
  'pl',
  'fr',
  'au',
  'dk',
  'tn',
  'es',
  'de',
  'jp',
  'cr',
  'be',
  'hr',
  'ma',
  'ca',
  'br',
  'rs',
  'ch',
  'cm',
  'pt',
  'gh',
  'uy',
  'kr',
] as const;

const FLAG_ICON_URL_BY_CODE: Partial<Record<(typeof FLAG_ICON_BUNDLE_ALLOWLIST)[number], string>> = {
  qa: new URL('../node_modules/flag-icons/flags/4x3/qa.svg', import.meta.url).href,
  ec: new URL('../node_modules/flag-icons/flags/4x3/ec.svg', import.meta.url).href,
  sn: new URL('../node_modules/flag-icons/flags/4x3/sn.svg', import.meta.url).href,
  nl: new URL('../node_modules/flag-icons/flags/4x3/nl.svg', import.meta.url).href,
  'gb-eng': new URL('../node_modules/flag-icons/flags/4x3/gb-eng.svg', import.meta.url).href,
  ir: new URL('../node_modules/flag-icons/flags/4x3/ir.svg', import.meta.url).href,
  us: new URL('../node_modules/flag-icons/flags/4x3/us.svg', import.meta.url).href,
  'gb-wls': new URL('../node_modules/flag-icons/flags/4x3/gb-wls.svg', import.meta.url).href,
  ar: new URL('../node_modules/flag-icons/flags/4x3/ar.svg', import.meta.url).href,
  sa: new URL('../node_modules/flag-icons/flags/4x3/sa.svg', import.meta.url).href,
  mx: new URL('../node_modules/flag-icons/flags/4x3/mx.svg', import.meta.url).href,
  pl: new URL('../node_modules/flag-icons/flags/4x3/pl.svg', import.meta.url).href,
  fr: new URL('../node_modules/flag-icons/flags/4x3/fr.svg', import.meta.url).href,
  au: new URL('../node_modules/flag-icons/flags/4x3/au.svg', import.meta.url).href,
  dk: new URL('../node_modules/flag-icons/flags/4x3/dk.svg', import.meta.url).href,
  tn: new URL('../node_modules/flag-icons/flags/4x3/tn.svg', import.meta.url).href,
  es: new URL('../node_modules/flag-icons/flags/4x3/es.svg', import.meta.url).href,
  de: new URL('../node_modules/flag-icons/flags/4x3/de.svg', import.meta.url).href,
  jp: new URL('../node_modules/flag-icons/flags/4x3/jp.svg', import.meta.url).href,
  cr: new URL('../node_modules/flag-icons/flags/4x3/cr.svg', import.meta.url).href,
  be: new URL('../node_modules/flag-icons/flags/4x3/be.svg', import.meta.url).href,
  hr: new URL('../node_modules/flag-icons/flags/4x3/hr.svg', import.meta.url).href,
  ma: new URL('../node_modules/flag-icons/flags/4x3/ma.svg', import.meta.url).href,
  ca: new URL('../node_modules/flag-icons/flags/4x3/ca.svg', import.meta.url).href,
  br: new URL('../node_modules/flag-icons/flags/4x3/br.svg', import.meta.url).href,
  rs: new URL('../node_modules/flag-icons/flags/4x3/rs.svg', import.meta.url).href,
  ch: new URL('../node_modules/flag-icons/flags/4x3/ch.svg', import.meta.url).href,
  cm: new URL('../node_modules/flag-icons/flags/4x3/cm.svg', import.meta.url).href,
  pt: new URL('../node_modules/flag-icons/flags/4x3/pt.svg', import.meta.url).href,
  gh: new URL('../node_modules/flag-icons/flags/4x3/gh.svg', import.meta.url).href,
  uy: new URL('../node_modules/flag-icons/flags/4x3/uy.svg', import.meta.url).href,
  kr: new URL('../node_modules/flag-icons/flags/4x3/kr.svg', import.meta.url).href,
};

export function flagIconCodeForTeam(teamId: WorldCupTeam['id']): string {
  return FLAG_ICON_CODE_BY_TEAM[teamId];
}

export function flagIconUrlForTeam(teamId: WorldCupTeam['id']): string | null {
  const code = flagIconCodeForTeam(teamId) as (typeof FLAG_ICON_BUNDLE_ALLOWLIST)[number];
  return FLAG_ICON_URL_BY_CODE[code] ?? null;
}
