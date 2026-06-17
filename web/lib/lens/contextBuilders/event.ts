export type Fact = { key: string; value: string; source: string };

export type FactsTable = {
  version: number;
  updated_at: string;
  facts: {
    global: Fact[];
    by_team: Record<string, Fact[]>;
    by_match: Record<string, Fact[]>;
  };
};

export type EventContextInput = {
  factsTable: FactsTable;
  matchId: string | null;
  teams: string[];
};

export type EventContext = {
  facts: Fact[];
};

export function buildEventContext(input: EventContextInput): EventContext {
  const { factsTable, matchId, teams } = input;
  const out: Fact[] = [];
  out.push(...factsTable.facts.global);
  for (const t of teams) {
    const items = factsTable.facts.by_team[t];
    if (items) out.push(...items);
  }
  if (matchId) {
    const items = factsTable.facts.by_match[matchId];
    if (items) out.push(...items);
  }
  return { facts: out };
}
