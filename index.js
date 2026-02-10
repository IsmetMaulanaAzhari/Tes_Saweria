/**
 * Saweria Discord Bot
 * Main Entry Point
 * 
 * Struktur Project:
 * ├── src/
 * │   ├── config.js          - Konfigurasi & konstanta
 * │   ├── database.js        - Setup database SQLite
 * │   ├── commands/
 * │   │   └── index.js       - Definisi slash commands
 * │   ├── handlers/
 * │   │   └── commandHandler.js - Handler interaksi commands
 * │   ├── modules/
 * │   │   ├── blacklist.js   - Filter kata terlarang
 * │   │   ├── donation.js    - Pemrosesan donasi
 * │   │   ├── goals.js       - Donation goals
 * │   │   ├── summary.js     - Rangkuman donasi
 * │   │   └── voice.js       - Voice channel & sound alert
 * │   ├── services/
 * │   │   └── saweria.js     - Koneksi Saweria socket
 * │   └── utils/
 * │       └── helpers.js     - Fungsi utilitas
 * └── index.js               - Entry point (file ini)
 */

const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');

// Config
const { DISCORD_TOKEN, VOICE_CHANNEL_ID, ENABLE_SOUND_ALERT } = require('./src/config');

// Database
const { dbHelpers, closeDatabase } = require('./src/database');

// Commands
const commands = require('./src/commands');
const { handleCommand } = require('./src/handlers/commandHandler');

// Modules
const { loadBlacklistFromDB } = require('./src/modules/blacklist');
const { joinVoice, cleanup: cleanupVoice } = require('./src/modules/voice');
const { setClient: setSummaryClient, setupAutoSummary, cleanup: cleanupSummary } = require('./src/modules/summary');
const { setClient: setDonationClient } = require('./src/modules/donation');

// Services
const { connectToSaweria } = require('./src/services/saweria');

// ==================== DISCORD CLIENT ====================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
    ]
});

// ==================== EVENT: READY ====================
client.once('ready', async () => {
    console.log(`✅ Bot Discord login sebagai ${client.user.tag}`);
    
    // Set client untuk modules yang membutuhkan
    setSummaryClient(client);
    setDonationClient(client);
    
    // Register slash commands
    try {
        const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
        console.log('🔄 Mendaftarkan slash commands...');
        
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands.map(cmd => cmd.toJSON()) },
        );
        
        console.log('✅ Slash commands berhasil didaftarkan!');
    } catch (error) {
        console.error('❌ Error mendaftarkan commands:', error);
    }
    
    // Connect ke Saweria
    connectToSaweria();
    
    // Load blacklist words from database
    loadBlacklistFromDB();
    
    // Set status bot
    client.user.setActivity('donasi | /donasihelp', { type: 3 });
    
    // Log database stats
    const stats = dbHelpers.getTotalStats.get();
    console.log(`📊 Database: ${stats.total_transactions} transaksi dari ${stats.total_donors} donatur`);
    
    // Load saved auto summary setting
    const savedSummary = dbHelpers.getSetting.get('auto_summary');
    if (savedSummary && savedSummary.value && savedSummary.value !== 'off') {
        setupAutoSummary(savedSummary.value);
        console.log(`⏰ Auto summary dimuat: ${savedSummary.value}`);
    }
    
    // Auto join voice channel if configured
    if (VOICE_CHANNEL_ID && ENABLE_SOUND_ALERT) {
        try {
            const voiceChannel = await client.channels.fetch(VOICE_CHANNEL_ID);
            if (voiceChannel) {
                await joinVoice(voiceChannel);
            }
        } catch (error) {
            console.error('⚠️ Gagal auto-join voice channel:', error.message);
        }
    }
});

// ==================== EVENT: INTERACTION ====================
client.on('interactionCreate', async (interaction) => {
    await handleCommand(interaction, client);
});

// ==================== ERROR HANDLING ====================
process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
});

process.on('SIGINT', () => {
    console.log('📴 Mematikan bot...');
    
    // Cleanup modules
    cleanupVoice();
    cleanupSummary();
    
    // Close database
    closeDatabase();
    
    process.exit(0);
});

// ==================== START BOT ====================
if (!DISCORD_TOKEN) {
    console.error('❌ DISCORD_TOKEN tidak ditemukan di file .env');
    console.log('📋 Silakan isi DISCORD_TOKEN di file .env');
    process.exit(1);
}

client.login(DISCORD_TOKEN);
