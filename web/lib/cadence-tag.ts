// 解析 question 末尾的 cadence 标签，供前端过滤与展示共用。
export type Cadence = 'daily' | 'weekly' | 'monthly' | 'quarterly';
export type ParsedCadence = Cadence | 'unknown';

const CADENCE_TAG_RE = /\[(daily|weekly|monthly|quarterly)\]\s*$/u;

export function parseCadenceTag(question: string): ParsedCadence {
  const match = question.match(CADENCE_TAG_RE);
  return match ? (match[1] as Cadence) : 'unknown';
}
