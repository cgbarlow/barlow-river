// Draft evidence. The site never writes to Iris. A draft lives in this browser
// and can be turned into a change request that follows the standing rule for
// the tree: update nodes AND edges, and reflect the change in both views.

import type { EvidenceCard } from './casefile.ts';

export interface Draft extends EvidenceCard {
  url: string;
  source: string;
  link: 'none' | 'confirm' | 'doubt' | 'dispute' | 'remove';
}

const KEY = 'river.drafts.v1';
export function loadDrafts(): Draft[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
export function saveDrafts(d: Draft[]) {
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* private mode: drafts last for the visit */ }
}

export interface Lookup {
  name: (id: string) => string;
  iris: (id: string) => string | undefined;
  parents: (id: string) => { id: string; names: string[] } | undefined;
  line: (id: string) => string;
}

const STATUS = { proven: 'Proven', doubt: 'In doubt', ruledout: 'Ruled out', open: 'Open' } as const;
const EDGE: Record<Draft['link'], string> = {
  none: '',
  confirm: 'Remove any doubt label from the child edge, and set research.confidence on the child to "documented".',
  doubt: 'Label the child edge "probable", and set research.confidence on the child to "hypothesis".',
  dispute: 'Label the child edge "disputed", and set research.confidence on the child to "disputed".',
  remove: 'Delete the child edge, and remove the family from the child\'s families_as_child and the child from the family\'s children.',
};

export function changeRequest(d: Draft, look: Lookup): string {
  const el = (id: string) => `${look.name(id)}${look.iris(id) ? ` (https://iris-uat.chrisbarlow.nz/elements/${look.iris(id)})` : ''}`;
  const child = d.people.find((id) => look.parents(id));
  const par = child ? look.parents(child) : undefined;
  const lines = [...new Set(d.people.map(look.line))];
  const out: string[] = [];
  out.push(`# Evidence for the Barlow Family Tree: ${d.title}`, '');
  out.push(`Status: ${STATUS[d.status]}`);
  out.push(`Source: ${d.source || 'not given'}${/^https?:\/\//.test(d.url) ? ` <${d.url}>` : ''}`, '');
  if (d.body) out.push(d.body, '');
  out.push('## Bears on');
  out.push(...(d.people.length ? d.people.map((id) => `- ${el(id)}`) : ['- nobody attached']), '');
  out.push('## Changes to make in Iris');
  out.push('Standing rule: update both nodes and edges so relationships stay intact, and reflect every change in the line view and the Full Family Tree view.', '');
  out.push('1. Nodes');
  const url = /^https?:\/\//.test(d.url) ? d.url : '';
  const cite = JSON.stringify({ source: d.source || 'not given', ...(url ? { url } : {}), detail: d.title });
  for (const id of d.people) out.push(`   - ${look.name(id)}: add the citation ${cite} and a dated research note.`);
  out.push('2. Edges');
  if (d.link !== 'none' && child && par) out.push(`   - Family ${par.id} (${par.names.join(' and ')}) to child ${look.name(child)}: ${EDGE[d.link]}`);
  else if (d.link !== 'none') out.push(`   - A link change was asked for (${d.link}) but no attached person has parents in the tree. Say which child and family before applying.`);
  else out.push('   - No relationship changes.');
  out.push('3. Views');
  out.push(`   - ${lines.map((l) => `${l} line`).join(', ') || 'The relevant line view'}: ${d.link === 'none' ? 'no layout change; check the node shows the new citation.' : 'apply the same edge change.'}`);
  out.push(`   - Full Family Tree: ${d.link === 'none' ? 'no layout change.' : 'apply the same edge change.'}`);
  out.push('4. Hypothesis document');
  out.push(`   - Add a dated entry under the update log if this bears on the open case, and move the status of the affected generation in "The line as it stands".`);
  return out.join('\n');
}
