/**
 * Utility/Helper Functions
 */

const { MILESTONES } = require('../config');

/**
 * Format angka ke format Rupiah
 * @param {number} amount - Jumlah dalam angka
 * @returns {string} Format Rupiah
 */
function formatRupiah(amount) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

/**
 * Buat progress bar visual
 * @param {number} current - Nilai saat ini
 * @param {number} target - Target nilai
 * @param {number} length - Panjang bar (default 20)
 * @returns {string} Progress bar string
 */
function createProgressBar(current, target, length = 20) {
    const percentage = Math.min(current / target, 1);
    const filledLength = Math.round(percentage * length);
    const emptyLength = length - filledLength;
    
    const filled = '█'.repeat(filledLength);
    const empty = '░'.repeat(emptyLength);
    
    return `${filled}${empty} ${(percentage * 100).toFixed(1)}%`;
}

/**
 * Dapatkan milestone berdasarkan jumlah donasi
 * @param {number} amount - Jumlah donasi
 * @returns {object|null} Milestone object atau null
 */
function getMilestone(amount) {
    for (const milestone of MILESTONES) {
        if (amount >= milestone.amount) {
            return milestone;
        }
    }
    return null;
}

/**
 * Generate ID unik
 * @param {string} prefix - Prefix untuk ID
 * @returns {string} ID unik
 */
function generateId(prefix = '') {
    return `${prefix}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

module.exports = {
    formatRupiah,
    createProgressBar,
    getMilestone,
    generateId,
};
