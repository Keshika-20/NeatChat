/**
 * LRU CACHE (Least Recently Used Cache)
 * Keeps the most recently accessed conversations in memory.
 * Uses a doubly linked list + hashmap for O(1) get and put.
 *
 * When cache is full, it evicts the LEAST recently used conversation.
 * This ensures frequently chatted contacts stay in cache.
 */

class LRUNode {
  constructor(key, value) {
    this.key = key;
    this.value = value;
    this.prev = null;
    this.next = null;
  }
}

class LRUCache {
  /**
   * @param {number} capacity - Maximum number of conversations to hold in cache
   */
  constructor(capacity = 10) {
    this.capacity = capacity;
    this.cache = new Map(); // key -> LRUNode

    // Sentinel head and tail nodes (dummy nodes to simplify edge cases)
    this.head = new LRUNode(null, null); // Most recently used side
    this.tail = new LRUNode(null, null); // Least recently used side
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  /**
   * Get a conversation from cache. Moves it to the front (most recent).
   * @param {string} key - Conversation key (e.g., "user1_user2")
   * @returns {any} - Cached value or null
   */
  get(key) {
    if (!this.cache.has(key)) return null;

    const node = this.cache.get(key);
    this._moveToFront(node); // Mark as most recently used
    return node.value;
  }

  /**
   * Put a conversation in cache. Evicts LRU if at capacity.
   * @param {string} key - Conversation key
   * @param {any} value - Conversation data
   */
  put(key, value) {
    if (this.cache.has(key)) {
      // Update existing node
      const node = this.cache.get(key);
      node.value = value;
      this._moveToFront(node);
    } else {
      // Create new node
      const newNode = new LRUNode(key, value);
      this.cache.set(key, newNode);
      this._addToFront(newNode);

      // Evict LRU if over capacity
      if (this.cache.size > this.capacity) {
        const lruNode = this._removeTail();
        this.cache.delete(lruNode.key);
      }
    }
  }

  /**
   * Get all cached conversations sorted from most to least recent
   * @returns {Array} - Array of {key, value} pairs
   */
  getAll() {
    const result = [];
    let node = this.head.next;
    while (node !== this.tail) {
      result.push({ key: node.key, value: node.value });
      node = node.next;
    }
    return result;
  }

  /** Remove a node from its current position in the list */
  _remove(node) {
    node.prev.next = node.next;
    node.next.prev = node.prev;
  }

  /** Add a node right after the head (most recently used position) */
  _addToFront(node) {
    node.next = this.head.next;
    node.prev = this.head;
    this.head.next.prev = node;
    this.head.next = node;
  }

  /** Move an existing node to the front */
  _moveToFront(node) {
    this._remove(node);
    this._addToFront(node);
  }

  /** Remove and return the tail node (least recently used) */
  _removeTail() {
    const lruNode = this.tail.prev;
    this._remove(lruNode);
    return lruNode;
  }

  /** Get cache size */
  get size() {
    return this.cache.size;
  }
}

module.exports = LRUCache;
