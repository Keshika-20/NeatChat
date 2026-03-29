/**
 * TRIE DATA STRUCTURE
 * Used for fast prefix-based message search.
 * Each node stores a character, and paths from root to leaf spell out words.
 * Time Complexity: O(m) for insert/search where m = word length
 */

class TrieNode {
  constructor() {
    this.children = {};       // Map of char -> TrieNode
    this.isEndOfWord = false; // Marks complete words
    this.messageIds = [];     // Message IDs containing this word
  }
}

class Trie {
  constructor() {
    this.root = new TrieNode();
  }

  /**
   * Insert a word and associate it with a message ID
   * @param {string} word - The word to insert
   * @param {string} messageId - ID of the message containing this word
   */
  insert(word, messageId) {
    word = word.toLowerCase().trim();
    let node = this.root;

    for (const char of word) {
      if (!node.children[char]) {
        node.children[char] = new TrieNode();
      }
      node = node.children[char];
    }

    node.isEndOfWord = true;
    // Avoid duplicate message IDs
    if (!node.messageIds.includes(messageId)) {
      node.messageIds.push(messageId);
    }
  }

  /**
   * Search for all message IDs where words start with the given prefix
   * @param {string} prefix - The search prefix
   * @returns {string[]} - Array of matching message IDs
   */
  searchByPrefix(prefix) {
    prefix = prefix.toLowerCase().trim();
    let node = this.root;

    // Traverse to the end of the prefix
    for (const char of prefix) {
      if (!node.children[char]) {
        return []; // Prefix not found
      }
      node = node.children[char];
    }

    // Collect all message IDs from this node downward
    const results = [];
    this._collectIds(node, results);
    return [...new Set(results)]; // Remove duplicates
  }

  /**
   * DFS helper to collect all message IDs under a given node
   */
  _collectIds(node, results) {
    if (node.isEndOfWord) {
      results.push(...node.messageIds);
    }
    for (const child of Object.values(node.children)) {
      this._collectIds(child, results);
    }
  }

  /**
   * Index all words from a message into the Trie
   * @param {object} message - Message object with id and content
   */
  indexMessage(message) {
    const words = message.content.split(/\s+/);
    for (const word of words) {
      const cleaned = word.replace(/[^a-zA-Z0-9]/g, '');
      if (cleaned.length > 1) { // Skip single chars and punctuation
        this.insert(cleaned, message.id);
      }
    }
  }
}

module.exports = Trie;
