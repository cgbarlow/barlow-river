// A small invented export in the shape Iris produces. No real people.
const person = (id: string, name: string, data: Record<string, unknown> = {}, description = '') => ({
  id: 'el-' + id, element_type: 'object', name, description,
  data: { classifier: 'Person', type: 'person', gedcom_id: id, full_name: name, given_names: name.split(' ')[0], surname: name.split(' ').slice(-1)[0], sex: 'M', is_deceased: true, ...data },
});
const family = (id: string, husb: string, wife: string, kids: string[], data: Record<string, unknown> = {}) => ({
  id: 'el-' + id, element_type: 'object', name: id,
  data: { classifier: 'Family', type: 'family', gedcom_id: id, partners: [{ gedcom_id: husb, gedcom_role: 'HUSB' }, { gedcom_id: wife, gedcom_role: 'WIFE' }], children: kids.map((k, i) => ({ gedcom_id: k, order: i + 1 })), ...data },
});

export const fixture = {
  exported_at: '2026-11-18T00:00:00Z',
  set: { name: 'Test Tree' },
  diagrams: [{
    data: {
      nodes: [{ id: 'F_F1', data: { entityId: 'el-F1' } }, { id: 'P_I3', data: { entityId: 'el-I3' } }, { id: 'P_I99', data: { entityId: 'el-I99' } }],
      edges: [{ source: 'F_F1', target: 'P_I3', data: { label: 'disputed' } }],
    },
  }],
  elements: [
    person('I1', 'Abel Stone', { birth: { date: '1600', place: 'Norwich, Norfolk, England' }, death: { date: '1660' }, citations: [{ source: 'FreeREG, St Mary baptisms', detail: 'Abel, son of Tom' }], notes: ['His descendant Zed Stone holds the family bible.', 'A plain note.', 'Images supplied by Zed.'] }, 'An old description.'),
    person('I2', 'Beth Lark', { sex: 'F', birth: null, death: null }),
    person('I3', 'Cain Stone', { birth: { date: '21 MAR 1649/50' }, death: { date: 'AFT 1700' }, source: 'FamilySearch Family Tree' }),
    person('I4', 'Dora Stone', { sex: 'F', birth: { date: '1915' }, death: { date: '1990' }, notes: ['Recent note that should not ship.'], citations: [{ source: 'A census', detail: 'Lives with daughter' }] }, 'Recent description.'),
    person('I5', 'Zed Stone', { is_deceased: false, birth: { date: '12 OCT 1982', place: 'Auckland, New Zealand' }, notes: ['private'], primary_photo: { thumbnail_url: 'https://example.com/z.jpg' } }, 'Born 12 Oct 1982.'),
    person('I6', 'Eve Stone', { sex: 'F', is_deceased: false, birth: { date: '2010' } }),
    // no flag at all: old enough to be settled by date
    { id: 'el-I99', element_type: 'object', name: 'Old Hugh', description: 'Born about 1613.', data: { notes: ['x'] } },
    // no flag at all and no date: must be treated as living
    person('I7', 'Flagless Modern', { is_deceased: undefined, birth: null }),
    family('F1', 'I1', 'I2', ['I3']),
    family('F2', 'I3', 'I4', ['I5'], { marriage: { date: '1940', place: 'Kent, England' } }),
    family('F3', 'I5', 'I7', ['I6'], { marriage: { date: '2008', place: 'Wellington, New Zealand' } }),
    { id: 'el-S1', element_type: 'object', name: 'A source', data: { classifier: 'Source', type: 'source' } },
    { id: 'el-M1', element_type: 'class', name: 'Person', data: { type: 'model' } },
  ],
};
