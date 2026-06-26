const HTML_COMMENT_OPEN = '<!--';
const HTML_COMMENT_CLOSE = '-->';

/**
 * Removes source-only authoring comments from a PostHTML tree.
 * @param {Array<unknown>} tree PostHTML syntax tree.
 * @returns {Array<unknown>} The same tree without HTML comment tokens.
 */
function stripAuthoringComments(tree) {
  const stripFromContent = content => {
    const strippedContent = [];

    content.forEach(item => {
      if (typeof item === 'string') {
        if (item.startsWith(HTML_COMMENT_OPEN) && item.endsWith(HTML_COMMENT_CLOSE)) {
          return;
        }

        const previousItem = strippedContent.at(-1);
        const retainedText = typeof previousItem === 'string' ? previousItem + item : item;
        if (retainedText.includes(HTML_COMMENT_OPEN)) {
          throw new Error('Rendered HTML contains an unrecognized comment token.');
        }

        if (typeof previousItem === 'string') {
          strippedContent[strippedContent.length - 1] = retainedText;
        } else {
          strippedContent.push(item);
        }
        return;
      }

      if (item && typeof item === 'object' && Array.isArray(item.content)) {
        item.content = stripFromContent(item.content);
      }

      strippedContent.push(item);
    });

    return strippedContent;
  };

  const strippedTree = stripFromContent(tree);
  tree.splice(0, tree.length, ...strippedTree);
  return tree;
}

module.exports = { stripAuthoringComments };
