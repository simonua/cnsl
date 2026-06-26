const HTML_COMMENT_PATTERN = /<!--[\s\S]*?-->/g;

/**
 * Removes source-only authoring comments from a PostHTML tree.
 * @param {Array<unknown>} tree PostHTML syntax tree.
 * @returns {Array<unknown>} The same tree without HTML comment tokens.
 */
function stripAuthoringComments(tree) {
  const stripFromContent = content => content.flatMap(item => {
    if (typeof item === 'string') {
      const strippedItem = item.replace(HTML_COMMENT_PATTERN, '');
      return strippedItem ? [strippedItem] : [];
    }

    if (item && typeof item === 'object' && Array.isArray(item.content)) {
      item.content = stripFromContent(item.content);
    }

    return [item];
  });

  const strippedTree = stripFromContent(tree);
  tree.splice(0, tree.length, ...strippedTree);
  return tree;
}

module.exports = { stripAuthoringComments };
