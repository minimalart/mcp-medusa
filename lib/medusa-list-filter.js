const MEDUSA_PAGE_SIZE = 50;

// Some Admin list routes expose fields they do not accept as filters. Count
// matches across projected pages, then fetch only the requested page by ID.
export async function listByExactField({ read, query, key, field, matches, candidateQuery }) {
  const { limit = MEDUSA_PAGE_SIZE, offset = 0 } = query;
  if (!Number.isSafeInteger(limit) || limit < 0 || !Number.isSafeInteger(offset) || offset < 0) {
    throw new Error('limit and offset must be non-negative integers.');
  }

  const ids = [];
  let count = 0;
  let candidateOffset = 0;
  while (true) {
    const { [key]: rows, count: candidateCount } = await read({
      ...query, ...candidateQuery, fields: `id,${field}`, limit: MEDUSA_PAGE_SIZE, offset: candidateOffset,
    });
    if (!Array.isArray(rows) || !Number.isSafeInteger(candidateCount)) {
      throw new Error(`Medusa returned an invalid ${key} page.`);
    }
    for (const row of rows) {
      if (!matches(row[field])) continue;
      if (typeof row.id !== 'string' || !row.id) throw new Error(`Medusa omitted a ${key} ID.`);
      if (count >= offset && ids.length < limit) ids.push(row.id);
      count += 1;
    }
    candidateOffset += rows.length;
    if (rows.length === 0 || candidateOffset >= candidateCount) break;
  }

  const records = [];
  for (let start = 0; start < ids.length; start += MEDUSA_PAGE_SIZE) {
    const batch = ids.slice(start, start + MEDUSA_PAGE_SIZE);
    const { [key]: rows } = await read({ ...query, id: batch, limit: batch.length, offset: 0 });
    const byId = new Map(rows.map((row) => [row.id, row]));
    for (const id of batch) {
      if (byId.has(id)) records.push(byId.get(id));
    }
  }
  return { [key]: records, count, offset, limit };
}
