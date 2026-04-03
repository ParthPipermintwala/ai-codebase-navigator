const normalizeStructure = (structure) => {
  if (Array.isArray(structure)) {
    return structure;
  }

  if (structure && typeof structure === "object") {
    if (Array.isArray(structure.selected_files)) {
      return structure.selected_files;
    }
  }

  return [];
};

const createNode = (name, isLeaf = false) => {
  if (isLeaf) {
    return { name };
  }

  return {
    name,
    children: [],
    _index: new Map(),
  };
};

const buildRepositoryMap = (structure) => {
  const paths = normalizeStructure(structure);
  const root = createNode("root");

  for (const rawPath of paths) {
    if (typeof rawPath !== "string" || !rawPath.trim()) {
      continue;
    }

    const segments = rawPath.split("/").filter(Boolean);
    if (!segments.length) {
      continue;
    }

    let current = root;

    for (let i = 0; i < segments.length; i += 1) {
      const name = segments[i];
      const isLeaf = i === segments.length - 1;

      let nextNode = current._index.get(name);
      if (!nextNode) {
        nextNode = createNode(name, isLeaf);
        current._index.set(name, nextNode);
        current.children.push(nextNode);
      }

      current = nextNode;
    }
  }

  const stripIndexes = (node) => {
    if (!node || !node.children) {
      return node;
    }

    for (const child of node.children) {
      stripIndexes(child);
    }

    delete node._index;
    return node;
  };

  return stripIndexes(root);
};

export { buildRepositoryMap };
