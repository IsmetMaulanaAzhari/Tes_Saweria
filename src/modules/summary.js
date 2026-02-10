/**
 * Summary Module
 * Mengelola rangkuman donasi harian dan mingguan
 */

const { EmbedBuilder } = require('discord.js');
const cron = require('node-cron');
const { dbHelpers } = require('../database');
const { formatRupiah } = require('../utils/helpers');
const { SUMMARY_CHANNEL_ID } = require('../config');

// Cron jobs storage
let dailyCronJob = null;
let weeklyCronJob = null;
let discordClient = null;

/**
 * Set Discord client untuk digunakan module ini
 * @param {Client} client - Discord client instance
 */
function setClient(client) {
    discordClient = client;
}

/**
 * Kirim rangkuman harian
 */
async function sendDailySummary() {
    try {
        if (!discordClient) {
            console.error('❌ Discord client tidak tersedia untuk summary');
            return;
        }
        
        const channel = await discordClient.channels.fetch(SUMMARY_CHANNEL_ID);
        if (!channel) return;
        
        const stats = dbHelpers.getDailyStats.get();
        const topDonors = dbHelpers.getDailyLeaderboard.all(5);
        
        if (stats.total_transactions === 0) {
            const embed = new EmbedBuilder()
                .setColor(0x808080)
                .setTitle('📊 Rangkuman Harian')
                .setDescription('Tidak ada donasi hari ini.')
                .setTimestamp();
            await channel.send({ embeds: [embed] });
            return;
        }
        
        const leaderboardText = topDonors
            .map((d, i) => `${i + 1}. **${d.donor_name}** - ${formatRupiah(d.total)}`)
            .join('\n');
        
        const embed = new EmbedBuilder()
            .setColor(0x00D26A)
            .setTitle('📊 Rangkuman Donasi Harian')
            .setDescription(`Ringkasan donasi hari ini (${new Date().toLocaleDateString('id-ID')})`)
            .addFields(
                { name: '💰 Total Terkumpul', value: formatRupiah(stats.total_amount), inline: true },
                { name: '👥 Jumlah Donatur', value: stats.total_donors.toString(), inline: true },
                { name: '📊 Total Transaksi', value: stats.total_transactions.toString(), inline: true },
                { name: '🏆 Top Donatur Hari Ini', value: leaderboardText || 'Tidak ada data' },
            )
            .setFooter({ text: 'Summary otomatis' })
            .setTimestamp();
        
        await channel.send({ embeds: [embed] });
        console.log('📊 Daily summary terkirim');
    } catch (error) {
        console.error('❌ Error sending daily summary:', error);
    }
}

/**
 * Kirim rangkuman mingguan
 */
async function sendWeeklySummary() {
    try {
        if (!discordClient) {
            console.error('❌ Discord client tidak tersedia untuk summary');
            return;
        }
        
        const channel = await discordClient.channels.fetch(SUMMARY_CHANNEL_ID);
        if (!channel) return;
        
        const stats = dbHelpers.getWeeklyStats.get();
        const topDonors = dbHelpers.getWeeklyLeaderboard.all(10);
        
        if (stats.total_transactions === 0) {
            const embed = new EmbedBuilder()
                .setColor(0x808080)
                .setTitle('📊 Rangkuman Mingguan')
                .setDescription('Tidak ada donasi minggu ini.')
                .setTimestamp();
            await channel.send({ embeds: [embed] });
            return;
        }
        
        const leaderboardText = topDonors
            .map((d, i) => {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
                return `${medal} **${d.donor_name}** - ${formatRupiah(d.total)}`;
            })
            .join('\n');
        
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('📊 Rangkuman Donasi Mingguan')
            .setDescription('Ringkasan donasi 7 hari terakhir')
            .addFields(
                { name: '💰 Total Terkumpul', value: formatRupiah(stats.total_amount), inline: true },
                { name: '👥 Jumlah Donatur', value: stats.total_donors.toString(), inline: true },
                { name: '📊 Total Transaksi', value: stats.total_transactions.toString(), inline: true },
                { name: '🏆 Top 10 Donatur Minggu Ini', value: leaderboardText || 'Tidak ada data' },
            )
            .setFooter({ text: 'Summary otomatis' })
            .setTimestamp();
        
        await channel.send({ embeds: [embed] });
        console.log('📊 Weekly summary terkirim');
    } catch (error) {
        console.error('❌ Error sending weekly summary:', error);
    }
}

/**
 * Setup auto summary dengan cron jobs
 * @param {string} mode - 'daily', 'weekly', 'both', atau 'off'
 */
function setupAutoSummary(mode) {
    // Clear existing jobs
    if (dailyCronJob) {
        dailyCronJob.stop();
        dailyCronJob = null;
    }
    if (weeklyCronJob) {
        weeklyCronJob.stop();
        weeklyCronJob = null;
    }
    
    if (mode === 'daily' || mode === 'both') {
        // Setiap hari jam 00:00 WIB
        dailyCronJob = cron.schedule('0 0 * * *', sendDailySummary, {
            timezone: 'Asia/Jakarta'
        });
        console.log('⏰ Daily summary aktif (00:00 WIB)');
    }
    
    if (mode === 'weekly' || mode === 'both') {
        // Setiap Senin jam 00:00 WIB
        weeklyCronJob = cron.schedule('0 0 * * 1', sendWeeklySummary, {
            timezone: 'Asia/Jakarta'
        });
        console.log('⏰ Weekly summary aktif (Senin 00:00 WIB)');
    }
    
    // Save setting
    dbHelpers.setSetting.run('auto_summary', mode);
}

/**
 * Cleanup cron jobs saat shutdown
 */
function cleanup() {
    if (dailyCronJob) dailyCronJob.stop();
    if (weeklyCronJob) weeklyCronJob.stop();
}

/**
 * Dapatkan stats berdasarkan periode
 * @param {string} periode - 'daily', 'weekly', atau 'all'
 * @returns {object} Stats dan leaderboard
 */
function getStatsByPeriod(periode) {
    let stats, topDonors, title, description;
    
    if (periode === 'daily') {
        stats = dbHelpers.getDailyStats.get();
        topDonors = dbHelpers.getDailyLeaderboard.all(5);
        title = '📊 Rangkuman Donasi Hari Ini';
        description = `Ringkasan donasi ${new Date().toLocaleDateString('id-ID')}`;
    } else if (periode === 'weekly') {
        stats = dbHelpers.getWeeklyStats.get();
        topDonors = dbHelpers.getWeeklyLeaderboard.all(10);
        title = '📊 Rangkuman Donasi Minggu Ini';
        description = 'Ringkasan donasi 7 hari terakhir';
    } else {
        stats = dbHelpers.getTotalStats.get();
        topDonors = dbHelpers.getLeaderboard.all(10);
        title = '📊 Rangkuman Donasi Semua Waktu';
        description = 'Ringkasan total semua donasi';
    }
    
    return { stats, topDonors, title, description };
}

module.exports = {
    setClient,
    sendDailySummary,
    sendWeeklySummary,
    setupAutoSummary,
    cleanup,
    getStatsByPeriod,
};
