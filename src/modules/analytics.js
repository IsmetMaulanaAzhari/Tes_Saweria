/**
 * Analytics Module
 * Statistik dan analisis donasi
 */

const { EmbedBuilder } = require('discord.js');
const { dbHelpers } = require('../database');
const { formatRupiah } = require('../utils/helpers');

// Day names in Indonesian
const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

/**
 * Get hourly donation statistics (last 7 days)
 * @returns {Array} Hourly stats
 */
function getHourlyStats() {
    const stats = dbHelpers.getHourlyStats.all();
    
    // Fill missing hours with 0
    const fullStats = [];
    for (let i = 0; i < 24; i++) {
        const hourStr = i.toString().padStart(2, '0');
        const found = stats.find(s => s.hour === hourStr);
        fullStats.push({
            hour: i,
            count: found ? found.count : 0,
            total: found ? found.total : 0
        });
    }
    
    return fullStats;
}

/**
 * Get day of week donation statistics (last 30 days)
 * @returns {Array} Daily stats
 */
function getDailyOfWeekStats() {
    const stats = dbHelpers.getDailyOfWeekStats.all();
    
    // Fill missing days with 0
    const fullStats = [];
    for (let i = 0; i < 7; i++) {
        const found = stats.find(s => parseInt(s.day_of_week) === i);
        fullStats.push({
            day: i,
            dayName: DAY_NAMES[i],
            count: found ? found.count : 0,
            total: found ? found.total : 0
        });
    }
    
    return fullStats;
}

/**
 * Get average, max, min donation amounts
 * @returns {object} Average stats
 */
function getAverageStats() {
    return dbHelpers.getAverageStats.get();
}

/**
 * Get monthly trend (last 6 months)
 * @returns {Array} Monthly stats
 */
function getMonthlyTrend() {
    return dbHelpers.getMonthlyTrend.all();
}

/**
 * Get peak donation hour
 * @returns {object} Peak hour info
 */
function getPeakHour() {
    const hourlyStats = getHourlyStats();
    let peakHour = { hour: 0, count: 0, total: 0 };
    
    for (const stat of hourlyStats) {
        if (stat.total > peakHour.total) {
            peakHour = stat;
        }
    }
    
    return peakHour;
}

/**
 * Get peak donation day
 * @returns {object} Peak day info
 */
function getPeakDay() {
    const dailyStats = getDailyOfWeekStats();
    let peakDay = { day: 0, dayName: 'Minggu', count: 0, total: 0 };
    
    for (const stat of dailyStats) {
        if (stat.total > peakDay.total) {
            peakDay = stat;
        }
    }
    
    return peakDay;
}

/**
 * Create bar chart using text
 * @param {number} value - Current value
 * @param {number} max - Maximum value
 * @param {number} length - Bar length
 * @returns {string} Bar string
 */
function createBar(value, max, length = 10) {
    if (max === 0) return '░'.repeat(length);
    const filled = Math.round((value / max) * length);
    return '█'.repeat(filled) + '░'.repeat(length - filled);
}

/**
 * Generate analytics embed
 * @returns {EmbedBuilder} Analytics embed
 */
function generateAnalyticsEmbed() {
    const totalStats = dbHelpers.getTotalStats.get();
    const avgStats = getAverageStats();
    const peakHour = getPeakHour();
    const peakDay = getPeakDay();
    const thisMonth = dbHelpers.getThisMonthStats.get();
    const lastMonth = dbHelpers.getLastMonthStats.get();
    
    // Calculate month-over-month change
    let momChange = 0;
    if (lastMonth.total_amount > 0) {
        momChange = ((thisMonth.total_amount - lastMonth.total_amount) / lastMonth.total_amount) * 100;
    }
    const momEmoji = momChange >= 0 ? '📈' : '📉';
    const momText = momChange >= 0 ? `+${momChange.toFixed(1)}%` : `${momChange.toFixed(1)}%`;
    
    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📊 Analytics Dashboard')
        .setDescription('Statistik dan analisis donasi')
        .addFields(
            { 
                name: '💰 Total Stats', 
                value: `**Total:** ${formatRupiah(totalStats.total_amount)}\n**Transaksi:** ${totalStats.total_transactions}\n**Donatur:** ${totalStats.total_donors}`,
                inline: true 
            },
            { 
                name: '📈 Rata-rata', 
                value: `**Average:** ${formatRupiah(Math.round(avgStats.average_amount))}\n**Max:** ${formatRupiah(avgStats.max_amount)}\n**Min:** ${formatRupiah(avgStats.min_amount)}`,
                inline: true 
            },
            { 
                name: `${momEmoji} Bulan Ini vs Lalu`, 
                value: `**Bulan ini:** ${formatRupiah(thisMonth.total_amount)}\n**Bulan lalu:** ${formatRupiah(lastMonth.total_amount)}\n**Perubahan:** ${momText}`,
                inline: true 
            },
            { 
                name: '⏰ Peak Hour (7 hari)', 
                value: `**Jam ${peakHour.hour}:00** - ${peakHour.count} transaksi\nTotal: ${formatRupiah(peakHour.total)}`,
                inline: true 
            },
            { 
                name: '📅 Peak Day (30 hari)', 
                value: `**${peakDay.dayName}** - ${peakDay.count} transaksi\nTotal: ${formatRupiah(peakDay.total)}`,
                inline: true 
            },
        )
        .setFooter({ text: 'Data diupdate real-time' })
        .setTimestamp();
    
    return embed;
}

/**
 * Generate hourly chart embed
 * @returns {EmbedBuilder} Hourly chart embed
 */
function generateHourlyChartEmbed() {
    const hourlyStats = getHourlyStats();
    const maxTotal = Math.max(...hourlyStats.map(s => s.total));
    
    let chartText = '';
    // Group by 4-hour blocks for readability
    const blocks = [
        { range: '00-03', hours: [0, 1, 2, 3] },
        { range: '04-07', hours: [4, 5, 6, 7] },
        { range: '08-11', hours: [8, 9, 10, 11] },
        { range: '12-15', hours: [12, 13, 14, 15] },
        { range: '16-19', hours: [16, 17, 18, 19] },
        { range: '20-23', hours: [20, 21, 22, 23] },
    ];
    
    for (const block of blocks) {
        const blockTotal = block.hours.reduce((sum, h) => sum + hourlyStats[h].total, 0);
        const blockCount = block.hours.reduce((sum, h) => sum + hourlyStats[h].count, 0);
        const bar = createBar(blockTotal, maxTotal * 4, 12);
        chartText += `\`${block.range}\` ${bar} ${formatRupiah(blockTotal)} (${blockCount}x)\n`;
    }
    
    const embed = new EmbedBuilder()
        .setColor(0x00D26A)
        .setTitle('⏰ Donasi per Jam (7 hari terakhir)')
        .setDescription(chartText || 'Belum ada data')
        .setFooter({ text: 'Format: [Jam] [Bar] [Total] (Jumlah transaksi)' })
        .setTimestamp();
    
    return embed;
}

/**
 * Generate daily chart embed
 * @returns {EmbedBuilder} Daily chart embed
 */
function generateDailyChartEmbed() {
    const dailyStats = getDailyOfWeekStats();
    const maxTotal = Math.max(...dailyStats.map(s => s.total));
    
    let chartText = '';
    for (const stat of dailyStats) {
        const bar = createBar(stat.total, maxTotal, 12);
        chartText += `\`${stat.dayName.padEnd(7)}\` ${bar} ${formatRupiah(stat.total)} (${stat.count}x)\n`;
    }
    
    const embed = new EmbedBuilder()
        .setColor(0xFF6B35)
        .setTitle('📅 Donasi per Hari (30 hari terakhir)')
        .setDescription(chartText || 'Belum ada data')
        .setFooter({ text: 'Format: [Hari] [Bar] [Total] (Jumlah transaksi)' })
        .setTimestamp();
    
    return embed;
}

/**
 * Generate monthly trend embed
 * @returns {EmbedBuilder} Monthly trend embed
 */
function generateMonthlyTrendEmbed() {
    const monthlyStats = getMonthlyTrend();
    const maxTotal = Math.max(...monthlyStats.map(s => s.total), 1);
    
    let chartText = '';
    for (const stat of monthlyStats.reverse()) {
        const bar = createBar(stat.total, maxTotal, 12);
        chartText += `\`${stat.month}\` ${bar} ${formatRupiah(stat.total)} (${stat.count}x)\n`;
    }
    
    const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('📈 Tren Bulanan (6 bulan terakhir)')
        .setDescription(chartText || 'Belum ada data')
        .setFooter({ text: 'Format: [Bulan] [Bar] [Total] (Jumlah transaksi)' })
        .setTimestamp();
    
    return embed;
}

module.exports = {
    getHourlyStats,
    getDailyOfWeekStats,
    getAverageStats,
    getMonthlyTrend,
    getPeakHour,
    getPeakDay,
    generateAnalyticsEmbed,
    generateHourlyChartEmbed,
    generateDailyChartEmbed,
    generateMonthlyTrendEmbed,
};
