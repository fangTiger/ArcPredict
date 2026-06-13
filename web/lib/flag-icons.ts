import {
  WORLDCUP_TEAMS,
  type WorldCupTeam,
} from './worldcup-seed';

export const FLAG_ICON_CODE_BY_TEAM = Object.fromEntries(
  WORLDCUP_TEAMS.map((team) => [team.id, team.flagCode]),
) as Record<WorldCupTeam['id'], string>;

export const FLAG_ICON_BUNDLE_ALLOWLIST = [
  'ar',
  'mx',
  'gb-eng',
  'gb-wls',
  'nl',
  'us',
  'br',
  'hr',
  'fr',
] as const;

const FLAG_ICON_URL_BY_CODE: Partial<Record<(typeof FLAG_ICON_BUNDLE_ALLOWLIST)[number], string>> = {
  ar: new URL('../node_modules/flag-icons/flags/4x3/ar.svg', import.meta.url).href,
  mx: new URL('../node_modules/flag-icons/flags/4x3/mx.svg', import.meta.url).href,
  'gb-eng': new URL('../node_modules/flag-icons/flags/4x3/gb-eng.svg', import.meta.url).href,
  'gb-wls': new URL('../node_modules/flag-icons/flags/4x3/gb-wls.svg', import.meta.url).href,
  nl: new URL('../node_modules/flag-icons/flags/4x3/nl.svg', import.meta.url).href,
  us: new URL('../node_modules/flag-icons/flags/4x3/us.svg', import.meta.url).href,
  br: new URL('../node_modules/flag-icons/flags/4x3/br.svg', import.meta.url).href,
  hr: new URL('../node_modules/flag-icons/flags/4x3/hr.svg', import.meta.url).href,
  fr: new URL('../node_modules/flag-icons/flags/4x3/fr.svg', import.meta.url).href,
};

export function flagIconCodeForTeam(teamId: WorldCupTeam['id']): string {
  return FLAG_ICON_CODE_BY_TEAM[teamId];
}

export function flagIconUrlForTeam(teamId: WorldCupTeam['id']): string | null {
  const code = flagIconCodeForTeam(teamId) as (typeof FLAG_ICON_BUNDLE_ALLOWLIST)[number];
  return FLAG_ICON_URL_BY_CODE[code] ?? null;
}
