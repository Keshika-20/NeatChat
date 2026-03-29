/**
 * MIN-HEAP DATA STRUCTURE
 * Used to prioritize messages (e.g., urgent/important messages bubble up).
 * A heap is a complete binary tree where each parent <= its children (min-heap).
 *
 * Priority levels:
 *   1 = HIGH (system alerts, urgent messages)
 *   2 = MEDIUM (mentions, replies)
 *   3 = LOW (normal messages)
 *
 * Time Complexity: O(log n) for insert/extract
 */

class MessageHeap {
  constructor() {
    this.heap = []; // Array-based binary heap
  }

  /**
   * Insert a message with a given priority
   * @param {object} message - Message object
   * @param {number} priority - 1 (high), 2 (medium), 3 (low)
   */
  insert(message, priority = 3) {
    const item = { message, priority };
    this.heap.push(item);
    this._bubbleUp(this.heap.length - 1);
  }

  /**
   * Extract the highest priority message (lowest priority number)
   * @returns {object|null} - Message or null if heap is empty
   */
  extractMin() {
    if (this.heap.length === 0) return null;
    if (this.heap.length === 1) return this.heap.pop().message;

    const min = this.heap[0];
    this.heap[0] = this.heap.pop(); // Move last element to top
    this._sinkDown(0);              // Restore heap property
    return min.message;
  }

  /**
   * Peek at the highest priority message without removing it
   */
  peek() {
    return this.heap.length > 0 ? this.heap[0].message : null;
  }

  /** Get all messages sorted by priority */
  getSorted() {
    const copy = [...this.heap];
    copy.sort((a, b) => a.priority - b.priority);
    return copy.map(item => ({ ...item.message, priority: item.priority }));
  }

  get size() {
    return this.heap.length;
  }

  // ---- Internal Heap Operations ----

  _parent(i) { return Math.floor((i - 1) / 2); }
  _leftChild(i) { return 2 * i + 1; }
  _rightChild(i) { return 2 * i + 2; }

  _swap(i, j) {
    [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
  }

  /** After insert: bubble the new element up until heap property is satisfied */
  _bubbleUp(i) {
    while (i > 0) {
      const parent = this._parent(i);
      if (this.heap[parent].priority <= this.heap[i].priority) break;
      this._swap(parent, i);
      i = parent;
    }
  }

  /** After extract: sink root down until heap property is satisfied */
  _sinkDown(i) {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const left = this._leftChild(i);
      const right = this._rightChild(i);

      if (left < n && this.heap[left].priority < this.heap[smallest].priority) {
        smallest = left;
      }
      if (right < n && this.heap[right].priority < this.heap[smallest].priority) {
        smallest = right;
      }

      if (smallest === i) break;
      this._swap(i, smallest);
      i = smallest;
    }
  }
}

module.exports = MessageHeap;
