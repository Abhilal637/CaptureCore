const Category = require('../models/category');

async function getDescendantIds(rootId) {
  const stack = [rootId];
  const all = [];
  while (stack.length) {
    const current = stack.pop();
    const children = await Category.find(
      { parentCategory: current, isDeleted: false },
      '_id'
    );
    for (const c of children) {
      all.push(c._id);
      stack.push(c._id);
    }
  }
  return all;
}

function normalizeBool(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v === 'true' || v === '1';
  return !!v;
}

module.exports = { getDescendantIds, normalizeBool };
