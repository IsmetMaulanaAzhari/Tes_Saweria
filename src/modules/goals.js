/**
 * Goals Module
 * Mengelola donation goals dan progress tracking
 */

const { EmbedBuilder } = require('discord.js');
const { dbHelpers } = require('../database');
const { formatRupiah, createProgressBar } = require('../utils/helpers');

/**
 * Set donation goal
 * @param {number} target - Target amount dalam Rupiah
 * @param {string} description - Deskripsi goal
 * @returns {object} Goal data
 */
function setGoal(target, description = 'Donation Goal') {
    const goalData = {
        target: target,
        description: description,
        createdAt: new Date().toISOString(),
    };
    
    dbHelpers.setSetting.run('donation_goal', JSON.stringify(goalData));
    return goalData;
}

/**
 * Dapatkan goal saat ini
 * @returns {object|null} Goal data atau null
 */
function getGoal() {
    const goalData = dbHelpers.getSetting.get('donation_goal');
    if (!goalData || !goalData.value) return null;
    
    try {
        return JSON.parse(goalData.value);
    } catch {
        return null;
    }
}

/**
 * Reset/hapus goal
 */
function resetGoal() {
    dbHelpers.setSetting.run('donation_goal', null);
}

/**
 * Dapatkan progress goal
 * @returns {object|null} Progress info atau null jika tidak ada goal
 */
function getGoalProgress() {
    const goal = getGoal();
    if (!goal) return null;
    
    const stats = dbHelpers.getTotalStats.get();
    const currentAmount = stats.total_amount;
    const remaining = Math.max(0, goal.target - currentAmount);
    const isComplete = currentAmount >= goal.target;
    const progressBar = createProgressBar(currentAmount, goal.target);
    
    return {
        goal,
        currentAmount,
        remaining,
        isComplete,
        progressBar,
        totalDonors: stats.total_donors,
    };
}

/**
 * Check apakah goal tercapai setelah donasi baru
 * @param {TextChannel} channel - Discord channel untuk notifikasi
 * @param {number} newAmount - Jumlah donasi baru
 */
async function checkGoalProgress(channel, newAmount) {
    const goal = getGoal();
    if (!goal) return;
    
    const stats = dbHelpers.getTotalStats.get();
    const currentAmount = stats.total_amount;
    const previousAmount = currentAmount - newAmount;
    
    // Check if we just hit the goal
    if (previousAmount < goal.target && currentAmount >= goal.target) {
        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('🎊 GOAL TERCAPAI!')
            .setDescription(`Target donasi **${goal.description || 'Donation Goal'}** telah tercapai!`)
            .addFields(
                { name: '🎯 Target', value: formatRupiah(goal.target), inline: true },
                { name: '💰 Terkumpul', value: formatRupiah(currentAmount), inline: true },
            )
            .setFooter({ text: 'Terima kasih kepada semua donatur! 🎉' })
            .setTimestamp();
        
        await channel.send({ content: '@everyone', embeds: [embed] });
    }
}

module.exports = {
    setGoal,
    getGoal,
    resetGoal,
    getGoalProgress,
    checkGoalProgress,
};
