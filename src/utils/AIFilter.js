/**
 * AI MESSAGE FILTER
 * Keyword-based spam detection and offensive content filtering.
 * This is a rule-based AI system that:
 *   1. Detects spam patterns (repeated chars, links, promotional content)
 *   2. Flags offensive/inappropriate language
 *   3. Generates smart reply suggestions based on message content
 *   4. Computes a message priority score
 */

// --- Offensive / Inappropriate Keywords ---
const OFFENSIVE_WORDS = [
  'spam', 'scam', 'hack', 'idiot', 'stupid', 'dumb', 'hate',
  'kill', 'die', 'loser', 'jerk', 'moron', 'fool', 'ugly', 'worthless'
];

// --- Spam Pattern Detectors ---
const SPAM_PATTERNS = [
  /(.)\1{4,}/,                   // Repeated character 5+ times (e.g., "heyyyy")
  /https?:\/\/[^\s]+/gi,         // URLs
  /\b(free|win|prize|click|buy now|offer|discount)\b/gi,  // Promo words
  /[A-Z]{6,}/,                   // Excessive caps (SHOUTING)
  /(\b\w+\b)(\s+\1){2,}/i        // Same word repeated 3+ times
];

// --- Smart Reply Templates ---
const SMART_REPLIES = {
  greeting: ["Hello! 👋", "Hey there!", "Hi! How are you?", "Good to hear from you!"],
  question: ["That's a great question!", "Let me think about that.", "Hmm, interesting!", "Sure, I can help with that!"],
  thanks: ["You're welcome! 😊", "No problem!", "Anytime!", "Happy to help!"],
  bye: ["Goodbye! 👋", "See you later!", "Take care!", "Bye! Talk soon."],
  positive: ["That's awesome! 🎉", "Great news!", "Sounds good!", "Nice one! 👍"],
  default: ["Got it!", "Okay!", "I see.", "Makes sense!", "Sure thing!"]
};

/**
 * Analyze a message for offensive content
 * @param {string} content - The message text
 * @returns {{ isOffensive: boolean, flaggedWords: string[] }}
 */
function detectOffensiveContent(content) {
  const lower = content.toLowerCase();
  const words = lower.split(/\s+/);
  const flaggedWords = [];

  for (const word of words) {
    const cleaned = word.replace(/[^a-zA-Z]/g, '');
    if (OFFENSIVE_WORDS.includes(cleaned)) {
      flaggedWords.push(cleaned);
    }
  }

  return {
    isOffensive: flaggedWords.length > 0,
    flaggedWords
  };
}

/**
 * Analyze a message for spam patterns
 * @param {string} content - The message text
 * @returns {{ isSpam: boolean, reason: string|null }}
 */
function detectSpam(content) {
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(content)) {
      return { isSpam: true, reason: `Matched pattern: ${pattern.toString()}` };
    }
  }

  // Check message length anomaly (very long single word = suspicious)
  const words = content.split(/\s+/);
  if (words.some(w => w.length > 30)) {
    return { isSpam: true, reason: 'Abnormally long word detected' };
  }

  return { isSpam: false, reason: null };
}

/**
 * Determine the priority of a message (used by MessageHeap)
 * @param {string} content
 * @param {boolean} isMention - Was the user @mentioned?
 * @returns {number} - 1 (high), 2 (medium), 3 (low)
 */
function getPriority(content, isMention = false) {
  if (isMention) return 1; // @mentions are always high priority
  if (content.includes('urgent') || content.includes('help') || content.includes('emergency')) return 1;
  if (content.includes('?') || content.length < 20) return 2;
  return 3;
}

/**
 * Censor offensive words by replacing with asterisks
 * @param {string} content
 * @returns {string} - Censored message
 */
function censorContent(content) {
  let censored = content;
  for (const word of OFFENSIVE_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    censored = censored.replace(regex, '*'.repeat(word.length));
  }
  return censored;
}

/**
 * Generate smart reply suggestions based on message content
 * @param {string} content - Incoming message
 * @returns {string[]} - Array of 3 smart reply options
 */
function getSmartReplies(content) {
  const lower = content.toLowerCase();

  let category = 'default';
  if (/\b(hi|hello|hey|howdy|sup)\b/.test(lower)) category = 'greeting';
  else if (/\?/.test(lower)) category = 'question';
  else if (/\b(thanks|thank you|thx|ty)\b/.test(lower)) category = 'thanks';
  else if (/\b(bye|goodbye|cya|see you|later)\b/.test(lower)) category = 'bye';
  else if (/\b(great|awesome|amazing|good|nice|love|happy|yay)\b/.test(lower)) category = 'positive';

  const replies = SMART_REPLIES[category];
  // Return 3 random unique suggestions
  const shuffled = replies.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(3, shuffled.length));
}

/**
 * Full message analysis — runs all checks
 * @param {string} content
 * @returns {object} - Full analysis result
 */
function analyzeMessage(content) {
  const offensiveCheck = detectOffensiveContent(content);
  const spamCheck = detectSpam(content);
  const priority = getPriority(content);
  const smartReplies = getSmartReplies(content);

  let processedContent = content;
  let blocked = false;
  let warning = null;

  if (offensiveCheck.isOffensive) {
    processedContent = censorContent(content);
    warning = `Message contained flagged words: ${offensiveCheck.flaggedWords.join(', ')}`;
  }

  if (spamCheck.isSpam) {
    blocked = true;
    warning = `Message flagged as spam: ${spamCheck.reason}`;
  }

  return {
    original: content,
    processed: processedContent,
    blocked,         // If true, message should not be sent
    warning,
    isOffensive: offensiveCheck.isOffensive,
    flaggedWords: offensiveCheck.flaggedWords,
    isSpam: spamCheck.isSpam,
    priority,
    smartReplies
  };
}

module.exports = { analyzeMessage, getSmartReplies, getPriority };
