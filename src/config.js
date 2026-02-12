/**
 * Konfigurasi aplikasi
 * Semua environment variables dan konstanta di sini
 */

require('dotenv').config();

module.exports = {
    // Discord Configuration
    DISCORD_TOKEN: process.env.DISCORD_TOKEN,
    DISCORD_CHANNEL_ID: process.env.DISCORD_CHANNEL_ID,
    GUILD_ID: process.env.GUILD_ID || null,
    
    // Saweria Configuration
    SAWERIA_STREAM_KEY: process.env.SAWERIA_STREAM_KEY,
    SAWERIA_USERNAME: process.env.SAWERIA_USERNAME || 'username_kamu',
    
    // Role Configuration
    TOP_DONATOR_ROLE_ID: process.env.TOP_DONATOR_ROLE_ID || null,
    
    // Voice Configuration
    VOICE_CHANNEL_ID: process.env.VOICE_CHANNEL_ID || null,
    ENABLE_SOUND_ALERT: process.env.ENABLE_SOUND_ALERT === 'true',
    SOUND_FILE: process.env.SOUND_FILE || 'alert.mp3',
    
    // TTS Configuration
    ENABLE_TTS: process.env.ENABLE_TTS === 'true',
    TTS_LANGUAGE: process.env.TTS_LANGUAGE || 'id', // id = Indonesia
    
    // Minimum Alert Configuration
    MIN_ALERT_AMOUNT: parseInt(process.env.MIN_ALERT_AMOUNT) || 0, // 0 = semua donasi ditampilkan
    MIN_TTS_AMOUNT: parseInt(process.env.MIN_TTS_AMOUNT) || 0, // 0 = semua donasi dibacakan TTS
    
    // Summary Configuration
    SUMMARY_CHANNEL_ID: process.env.SUMMARY_CHANNEL_ID || process.env.DISCORD_CHANNEL_ID,
    
    // Milestone thresholds (dalam Rupiah)
    MILESTONES: [
        { amount: 500000, emoji: '💎', title: 'DONASI DIAMOND!' },
        { amount: 200000, emoji: '🌟', title: 'DONASI SUPER!' },
        { amount: 100000, emoji: '⭐', title: 'DONASI BINTANG!' },
        { amount: 50000, emoji: '🔥', title: 'DONASI SPESIAL!' },
    ],
    
    // Default blacklist words
    DEFAULT_BLACKLIST: [
        'anjing', 'bangsat', 'babi', 'kontol', 'memek', 'ngentot', 
        'tolol', 'goblok', 'idiot', 'bajingan', 'keparat', 'brengsek',
        'tai', 'asu', 'jancok', 'cuk', 'jembut'
    ],
};
