/**
 * Blacklist Module
 * Mengelola kata-kata terlarang untuk filter pesan donasi
 */

const { dbHelpers } = require('../database');
const { DEFAULT_BLACKLIST } = require('../config');

// In-memory storage untuk performa cepat
let blacklistWords = new Set(DEFAULT_BLACKLIST);

/**
 * Load blacklist words dari database ke memory
 */
function loadBlacklistFromDB() {
    const words = dbHelpers.getBlacklistWords.all();
    words.forEach(w => blacklistWords.add(w.word.toLowerCase()));
    console.log(`📝 Loaded ${blacklistWords.size} blacklist words`);
}

/**
 * Tambah kata ke blacklist
 * @param {string} word - Kata yang akan ditambahkan
 * @param {string} addedBy - Siapa yang menambahkan
 * @returns {boolean} Berhasil atau tidak
 */
function addToBlacklist(word, addedBy = 'system') {
    const lowerWord = word.toLowerCase().trim();
    if (lowerWord.length < 2) return false;
    
    dbHelpers.addBlacklistWord.run(lowerWord, addedBy);
    blacklistWords.add(lowerWord);
    return true;
}

/**
 * Hapus kata dari blacklist
 * @param {string} word - Kata yang akan dihapus
 * @returns {boolean} Berhasil atau tidak
 */
function removeFromBlacklist(word) {
    const lowerWord = word.toLowerCase().trim();
    dbHelpers.removeBlacklistWord.run(lowerWord);
    blacklistWords.delete(lowerWord);
    return true;
}

/**
 * Sensor pesan dengan mengganti kata terlarang dengan asterisk
 * @param {string} message - Pesan yang akan disensor
 * @returns {string} Pesan yang sudah disensor
 */
function censorMessage(message) {
    if (!message) return message;
    
    let censoredMessage = message;
    const words = message.toLowerCase().split(/\s+/);
    
    for (const word of words) {
        // Clean word dari punctuation untuk pengecekan
        const cleanWord = word.replace(/[^a-zA-Z0-9]/g, '');
        
        if (blacklistWords.has(cleanWord)) {
            // Buat regex untuk replace dengan case-insensitive
            const regex = new RegExp(cleanWord, 'gi');
            const censor = '*'.repeat(cleanWord.length);
            censoredMessage = censoredMessage.replace(regex, censor);
        }
    }
    
    // Check juga partial match untuk kata yang digabung
    for (const blockedWord of blacklistWords) {
        if (blockedWord.length >= 3 && censoredMessage.toLowerCase().includes(blockedWord)) {
            const regex = new RegExp(blockedWord, 'gi');
            const censor = '*'.repeat(blockedWord.length);
            censoredMessage = censoredMessage.replace(regex, censor);
        }
    }
    
    return censoredMessage;
}

/**
 * Cek apakah pesan mengandung kata terlarang
 * @param {string} message - Pesan yang akan dicek
 * @returns {boolean} True jika mengandung kata terlarang
 */
function containsBlacklistedWord(message) {
    if (!message) return false;
    const lowerMessage = message.toLowerCase();
    
    for (const word of blacklistWords) {
        if (lowerMessage.includes(word)) {
            return true;
        }
    }
    return false;
}

/**
 * Dapatkan semua kata dalam blacklist
 * @returns {Set<string>} Set berisi kata-kata terlarang
 */
function getBlacklistWords() {
    return blacklistWords;
}

/**
 * Dapatkan jumlah kata dalam blacklist
 * @returns {number} Jumlah kata
 */
function getBlacklistCount() {
    return blacklistWords.size;
}

module.exports = {
    loadBlacklistFromDB,
    addToBlacklist,
    removeFromBlacklist,
    censorMessage,
    containsBlacklistedWord,
    getBlacklistWords,
    getBlacklistCount,
};
