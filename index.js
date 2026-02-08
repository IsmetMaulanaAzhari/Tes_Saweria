require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { io } = require('socket.io-client');
const Database = require('better-sqlite3');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const cron = require('node-cron');
const path = require('path');
const fs = require('fs');

// ==================== KONFIGURASI ====================
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const SAWERIA_STREAM_KEY = process.env.SAWERIA_STREAM_KEY;
const SAWERIA_USERNAME = process.env.SAWERIA_USERNAME || 'username_kamu';
const TOP_DONATOR_ROLE_ID = process.env.TOP_DONATOR_ROLE_ID || null;
const GUILD_ID = process.env.GUILD_ID || null;
const VOICE_CHANNEL_ID = process.env.VOICE_CHANNEL_ID || null;
const SUMMARY_CHANNEL_ID = process.env.SUMMARY_CHANNEL_ID || process.env.DISCORD_CHANNEL_ID;
const ENABLE_SOUND_ALERT = process.env.ENABLE_SOUND_ALERT === 'true';
const SOUND_FILE = process.env.SOUND_FILE || 'alert.mp3';

// Milestone thresholds (dalam Rupiah)
const MILESTONES = [
    { amount: 500000, emoji: '💎', title: 'DONASI DIAMOND!' },
    { amount: 200000, emoji: '🌟', title: 'DONASI SUPER!' },
    { amount: 100000, emoji: '⭐', title: 'DONASI BINTANG!' },
    { amount: 50000, emoji: '🔥', title: 'DONASI SPESIAL!' },
];

// ==================== DATABASE SQLITE ====================
const db = new Database('donations.db');

// Inisialisasi tabel
db.exec(`
    CREATE TABLE IF NOT EXISTS donations (
        id TEXT PRIMARY KEY,
        donor_name TEXT NOT NULL,
        amount INTEGER NOT NULL,
        message TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    );
    
    CREATE INDEX IF NOT EXISTS idx_donor_name ON donations(donor_name);
    CREATE INDEX IF NOT EXISTS idx_timestamp ON donations(timestamp);
`);

// Database helper functions
const dbHelpers = {
    addDonation: db.prepare(`
        INSERT INTO donations (id, donor_name, amount, message, timestamp)
        VALUES (?, ?, ?, ?, datetime('now'))
    `),
    
    getLeaderboard: db.prepare(`
        SELECT donor_name, SUM(amount) as total
        FROM donations
        GROUP BY donor_name
        ORDER BY total DESC
        LIMIT ?
    `),
    
    getRecentDonations: db.prepare(`
        SELECT * FROM donations
        ORDER BY timestamp DESC
        LIMIT ?
    `),
    
    getTotalStats: db.prepare(`
        SELECT 
            COALESCE(SUM(amount), 0) as total_amount,
            COUNT(DISTINCT donor_name) as total_donors,
            COUNT(*) as total_transactions
        FROM donations
    `),
    
    getSetting: db.prepare(`SELECT value FROM settings WHERE key = ?`),
    setSetting: db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`),
    
    getTopDonor: db.prepare(`
        SELECT donor_name, SUM(amount) as total
        FROM donations
        GROUP BY donor_name
        ORDER BY total DESC
        LIMIT 1
    `),
    
    // Daily summary - donasi hari ini
    getDailyStats: db.prepare(`
        SELECT 
            COALESCE(SUM(amount), 0) as total_amount,
            COUNT(DISTINCT donor_name) as total_donors,
            COUNT(*) as total_transactions
        FROM donations
        WHERE date(timestamp) = date('now')
    `),
    
    getDailyLeaderboard: db.prepare(`
        SELECT donor_name, SUM(amount) as total
        FROM donations
        WHERE date(timestamp) = date('now')
        GROUP BY donor_name
        ORDER BY total DESC
        LIMIT ?
    `),
    
    // Weekly summary - donasi minggu ini
    getWeeklyStats: db.prepare(`
        SELECT 
            COALESCE(SUM(amount), 0) as total_amount,
            COUNT(DISTINCT donor_name) as total_donors,
            COUNT(*) as total_transactions
        FROM donations
        WHERE timestamp >= datetime('now', '-7 days')
    `),
    
    getWeeklyLeaderboard: db.prepare(`
        SELECT donor_name, SUM(amount) as total
        FROM donations
        WHERE timestamp >= datetime('now', '-7 days')
        GROUP BY donor_name
        ORDER BY total DESC
        LIMIT ?
    `),
};

// ==================== DISCORD CLIENT ====================
// Audio player untuk sound alert
let audioPlayer = null;
let voiceConnection = null;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
    ]
});

// ==================== SLASH COMMANDS ====================
const commands = [
    new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Tampilkan top donatur')
        .addIntegerOption(option =>
            option.setName('jumlah')
                .setDescription('Jumlah top donatur yang ditampilkan')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(25)
        ),
    new SlashCommandBuilder()
        .setName('donasi')
        .setDescription('Informasi cara donasi'),
    new SlashCommandBuilder()
        .setName('donasihelp')
        .setDescription('Bantuan perintah bot'),
    new SlashCommandBuilder()
        .setName('recentdonasi')
        .setDescription('Tampilkan donasi terbaru')
        .addIntegerOption(option =>
            option.setName('jumlah')
                .setDescription('Jumlah donasi yang ditampilkan')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(10)
        ),
    new SlashCommandBuilder()
        .setName('totaldonasi')
        .setDescription('Tampilkan total donasi yang terkumpul'),
    new SlashCommandBuilder()
        .setName('testdonasi')
        .setDescription('Test notifikasi donasi (Admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('nama')
                .setDescription('Nama donatur')
                .setRequired(false)
        )
        .addIntegerOption(option =>
            option.setName('jumlah')
                .setDescription('Jumlah donasi')
                .setRequired(false)
                .setMinValue(1000)
        )
        .addStringOption(option =>
            option.setName('pesan')
                .setDescription('Pesan donatur')
                .setRequired(false)
        ),
    new SlashCommandBuilder()
        .setName('setgoal')
        .setDescription('Set target donasi (Admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addIntegerOption(option =>
            option.setName('target')
                .setDescription('Target amount dalam Rupiah')
                .setRequired(true)
                .setMinValue(10000)
        )
        .addStringOption(option =>
            option.setName('deskripsi')
                .setDescription('Deskripsi goal')
                .setRequired(false)
        ),
    new SlashCommandBuilder()
        .setName('goal')
        .setDescription('Tampilkan progress donation goal'),
    new SlashCommandBuilder()
        .setName('resetgoal')
        .setDescription('Reset donation goal (Admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    // New commands
    new SlashCommandBuilder()
        .setName('summary')
        .setDescription('Tampilkan rangkuman donasi')
        .addStringOption(option =>
            option.setName('periode')
                .setDescription('Periode rangkuman')
                .setRequired(false)
                .addChoices(
                    { name: 'Hari ini', value: 'daily' },
                    { name: 'Minggu ini', value: 'weekly' },
                    { name: 'Semua waktu', value: 'all' }
                )
        ),
    new SlashCommandBuilder()
        .setName('joinvc')
        .setDescription('Bot bergabung ke voice channel (Admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Voice channel untuk sound alert')
                .setRequired(false)
        ),
    new SlashCommandBuilder()
        .setName('leavevc')
        .setDescription('Bot keluar dari voice channel (Admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
        .setName('autosummary')
        .setDescription('Atur summary otomatis harian/mingguan (Admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('mode')
                .setDescription('Mode summary otomatis')
                .setRequired(true)
                .addChoices(
                    { name: 'Aktifkan Harian (jam 00:00)', value: 'daily' },
                    { name: 'Aktifkan Mingguan (Senin 00:00)', value: 'weekly' },
                    { name: 'Aktifkan Keduanya', value: 'both' },
                    { name: 'Nonaktifkan', value: 'off' }
                )
        ),
];

// ==================== FUNGSI UTILITAS ====================
function formatRupiah(amount) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

function createProgressBar(current, target, length = 20) {
    const percentage = Math.min(current / target, 1);
    const filledLength = Math.round(percentage * length);
    const emptyLength = length - filledLength;
    
    const filled = '█'.repeat(filledLength);
    const empty = '░'.repeat(emptyLength);
    
    return `${filled}${empty} ${(percentage * 100).toFixed(1)}%`;
}

function getMilestone(amount) {
    for (const milestone of MILESTONES) {
        if (amount >= milestone.amount) {
            return milestone;
        }
    }
    return null;
}

// ==================== VOICE & SOUND ALERT ====================
async function joinVoice(channel) {
    try {
        voiceConnection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
        });
        
        audioPlayer = createAudioPlayer();
        voiceConnection.subscribe(audioPlayer);
        
        await entersState(voiceConnection, VoiceConnectionStatus.Ready, 30_000);
        console.log(`🔊 Bot bergabung ke voice channel: ${channel.name}`);
        return true;
    } catch (error) {
        console.error('❌ Error joining voice channel:', error);
        return false;
    }
}

function leaveVoice() {
    if (voiceConnection) {
        voiceConnection.destroy();
        voiceConnection = null;
        audioPlayer = null;
        console.log('🔇 Bot keluar dari voice channel');
        return true;
    }
    return false;
}

async function playSoundAlert() {
    if (!audioPlayer || !voiceConnection) return;
    
    const soundPath = path.join(__dirname, SOUND_FILE);
    if (!fs.existsSync(soundPath)) {
        console.warn(`⚠️ File suara tidak ditemukan: ${soundPath}`);
        return;
    }
    
    try {
        const resource = createAudioResource(soundPath);
        audioPlayer.play(resource);
        console.log('🔔 Sound alert dimainkan');
    } catch (error) {
        console.error('❌ Error playing sound:', error);
    }
}

// ==================== SUMMARY FUNCTIONS ====================
async function sendDailySummary() {
    try {
        const channel = await client.channels.fetch(SUMMARY_CHANNEL_ID);
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

async function sendWeeklySummary() {
    try {
        const channel = await client.channels.fetch(SUMMARY_CHANNEL_ID);
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

// Cron jobs storage
let dailyCronJob = null;
let weeklyCronJob = null;

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
        // Setiap hari jam 00:00
        dailyCronJob = cron.schedule('0 0 * * *', sendDailySummary, {
            timezone: 'Asia/Jakarta'
        });
        console.log('⏰ Daily summary aktif (00:00 WIB)');
    }
    
    if (mode === 'weekly' || mode === 'both') {
        // Setiap Senin jam 00:00
        weeklyCronJob = cron.schedule('0 0 * * 1', sendWeeklySummary, {
            timezone: 'Asia/Jakarta'
        });
        console.log('⏰ Weekly summary aktif (Senin 00:00 WIB)');
    }
    
    // Save setting
    dbHelpers.setSetting.run('auto_summary', mode);
}

// ==================== ROLE REWARDS ====================
async function updateTopDonatorRole() {
    if (!TOP_DONATOR_ROLE_ID || !GUILD_ID) return;
    
    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        const role = await guild.roles.fetch(TOP_DONATOR_ROLE_ID);
        if (!role) return;
        
        // Get current top donor
        const topDonor = dbHelpers.getTopDonor.get();
        if (!topDonor) return;
        
        // Remove role from all members who have it
        const membersWithRole = role.members;
        for (const [memberId, member] of membersWithRole) {
            await member.roles.remove(role);
        }
        
        // Log top donor info
        console.log(`🏆 Top donatur saat ini: ${topDonor.donor_name} dengan total ${formatRupiah(topDonor.total)}`);
        
    } catch (error) {
        console.error('❌ Error updating top donator role:', error);
    }
}

// ==================== SAWERIA CONNECTION ====================
function connectToSaweria() {
    if (!SAWERIA_STREAM_KEY) {
        console.error('❌ SAWERIA_STREAM_KEY tidak ditemukan di .env');
        return;
    }

    console.log('🔗 Menghubungkan ke Saweria...');
    
    const socket = io('https://events.saweria.co', {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
        console.log('✅ Terhubung ke Saweria Socket');
        socket.emit('join', SAWERIA_STREAM_KEY);
    });

    socket.on('disconnect', () => {
        console.log('⚠️ Terputus dari Saweria Socket, mencoba menghubungkan kembali...');
    });

    socket.on('donations', async (data) => {
        console.log('💰 Donasi diterima:', data);
        await handleDonation(data, false);
    });

    socket.on('error', (error) => {
        console.error('❌ Error Saweria Socket:', error);
    });
}

// ==================== HANDLE DONASI ====================
async function handleDonation(data, isTest = false) {
    try {
        const channel = await client.channels.fetch(DISCORD_CHANNEL_ID);
        if (!channel) {
            console.error('❌ Channel tidak ditemukan!');
            return;
        }

        // Parse data donasi
        const donation = {
            id: data.id || Date.now().toString(),
            donorName: data.donator || 'Anonim',
            amount: data.amount || 0,
            message: data.message || '',
            media: data.media || null, // URL media/GIF
            timestamp: new Date(),
        };

        // Simpan ke database (hanya jika bukan test)
        if (!isTest) {
            dbHelpers.addDonation.run(
                donation.id,
                donation.donorName,
                donation.amount,
                donation.message
            );
        }

        // Check milestone
        const milestone = getMilestone(donation.amount);
        
        // Buat embed notifikasi
        const embed = new EmbedBuilder()
            .setColor(milestone ? 0xFFD700 : 0xFF6B35)
            .setTitle(milestone ? `${milestone.emoji} ${milestone.title}` : '🎉 Donasi Baru!')
            .setDescription(`**${donation.donorName}** telah berdonasi!`)
            .addFields(
                { name: '💵 Jumlah', value: formatRupiah(donation.amount), inline: true },
                { name: '📅 Waktu', value: `<t:${Math.floor(donation.timestamp.getTime() / 1000)}:R>`, inline: true },
            )
            .setThumbnail('https://saweria.co/favicon.ico')
            .setFooter({ text: isTest ? '⚠️ INI ADALAH TEST DONASI' : 'Terima kasih atas dukungannya! 💖' })
            .setTimestamp();

        // Tambahkan pesan donatur jika ada
        if (donation.message) {
            embed.addFields({ name: '💬 Pesan', value: donation.message });
        }

        // Tambahkan media/GIF jika ada
        if (donation.media && donation.media.src) {
            embed.setImage(donation.media.src);
            embed.addFields({ name: '🎬 Media', value: `[Lihat Media](${donation.media.src})` });
        }

        // Kirim notifikasi
        const messageContent = milestone && !isTest ? '@everyone' : undefined;
        await channel.send({ content: messageContent, embeds: [embed] });
        
        console.log('✅ Notifikasi donasi terkirim ke Discord');

        // Play sound alert jika aktif
        if (ENABLE_SOUND_ALERT && voiceConnection && !isTest) {
            await playSoundAlert();
        }

        // Update goal progress jika ada
        if (!isTest) {
            await checkGoalProgress(channel, donation.amount);
            await updateTopDonatorRole();
        }
        
    } catch (error) {
        console.error('❌ Error mengirim notifikasi:', error);
    }
}

// ==================== GOAL PROGRESS ====================
async function checkGoalProgress(channel, newAmount) {
    const goalData = dbHelpers.getSetting.get('donation_goal');
    if (!goalData) return;
    
    const goal = JSON.parse(goalData.value);
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

// ==================== DISCORD EVENT HANDLERS ====================
client.once('ready', async () => {
    console.log(`✅ Bot Discord login sebagai ${client.user.tag}`);
    
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

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    try {
        switch (commandName) {
            case 'leaderboard': {
                const limit = interaction.options.getInteger('jumlah') || 10;
                const topDonors = dbHelpers.getLeaderboard.all(limit);
                
                if (topDonors.length === 0) {
                    await interaction.reply({
                        content: '📊 Belum ada donasi yang tercatat.',
                        ephemeral: true
                    });
                    return;
                }

                const leaderboardText = topDonors
                    .map((donor, index) => {
                        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                        return `${medal} **${donor.donor_name}** - ${formatRupiah(donor.total)}`;
                    })
                    .join('\n');

                const embed = new EmbedBuilder()
                    .setColor(0xFFD700)
                    .setTitle('🏆 Top Donatur')
                    .setDescription(leaderboardText)
                    .setFooter({ text: `Menampilkan ${topDonors.length} donatur teratas` })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
                break;
            }

            case 'donasi': {
                const embed = new EmbedBuilder()
                    .setColor(0xFF6B35)
                    .setTitle('💝 Cara Donasi')
                    .setDescription('Dukung kreator favorit kamu melalui Saweria!')
                    .addFields(
                        { name: '🔗 Link Donasi', value: `https://saweria.co/${SAWERIA_USERNAME}` },
                        { name: '📋 Cara Donasi', value: 
                            '1. Kunjungi link di atas\n' +
                            '2. Masukkan nama dan jumlah donasi\n' +
                            '3. Tulis pesan (opsional)\n' +
                            '4. Pilih metode pembayaran\n' +
                            '5. Selesaikan pembayaran'
                        },
                    )
                    .setThumbnail('https://saweria.co/favicon.ico')
                    .setFooter({ text: 'Terima kasih atas dukungannya! 💖' });

                await interaction.reply({ embeds: [embed] });
                break;
            }

            case 'donasihelp': {
                const embed = new EmbedBuilder()
                    .setColor(0x5865F2)
                    .setTitle('📖 Bantuan Perintah Bot')
                    .setDescription('Daftar semua perintah yang tersedia:')
                    .addFields(
                        { name: '📊 Informasi', value: 
                            '`/leaderboard` - Top donatur\n' +
                            '`/recentdonasi` - Donasi terbaru\n' +
                            '`/totaldonasi` - Statistik donasi\n' +
                            '`/goal` - Progress donation goal\n' +
                            '`/donasi` - Cara berdonasi'
                        },
                        { name: '🔧 Admin Only', value: 
                            '`/testdonasi` - Test notifikasi\n' +
                            '`/setgoal` - Set target donasi\n' +
                            '`/resetgoal` - Reset goal'
                        },
                    )
                    .setFooter({ text: 'Saweria Discord Bot' })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
                break;
            }

            case 'recentdonasi': {
                const limit = interaction.options.getInteger('jumlah') || 5;
                const recentDonations = dbHelpers.getRecentDonations.all(limit);

                if (recentDonations.length === 0) {
                    await interaction.reply({
                        content: '📋 Belum ada donasi yang tercatat.',
                        ephemeral: true
                    });
                    return;
                }

                const donationList = recentDonations
                    .map((d, i) => `${i + 1}. **${d.donor_name}** - ${formatRupiah(d.amount)}\n   └ ${d.message || 'Tidak ada pesan'}`)
                    .join('\n\n');

                const embed = new EmbedBuilder()
                    .setColor(0x00D26A)
                    .setTitle('📋 Donasi Terbaru')
                    .setDescription(donationList)
                    .setFooter({ text: `Menampilkan ${recentDonations.length} donasi terbaru` })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
                break;
            }

            case 'totaldonasi': {
                const stats = dbHelpers.getTotalStats.get();

                const embed = new EmbedBuilder()
                    .setColor(0x00D26A)
                    .setTitle('💰 Statistik Donasi')
                    .addFields(
                        { name: '💵 Total Terkumpul', value: formatRupiah(stats.total_amount), inline: true },
                        { name: '👥 Jumlah Donatur', value: stats.total_donors.toString(), inline: true },
                        { name: '📊 Total Transaksi', value: stats.total_transactions.toString(), inline: true },
                    )
                    .setFooter({ text: 'Terima kasih kepada semua donatur! 💖' })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
                break;
            }

            case 'testdonasi': {
                const nama = interaction.options.getString('nama') || 'Test Donatur';
                const jumlah = interaction.options.getInteger('jumlah') || 10000;
                const pesan = interaction.options.getString('pesan') || 'Ini adalah test donasi!';

                await interaction.reply({
                    content: '✅ Mengirim test donasi...',
                    ephemeral: true
                });

                await handleDonation({
                    id: `test_${Date.now()}`,
                    donator: nama,
                    amount: jumlah,
                    message: pesan,
                }, true);
                break;
            }

            case 'setgoal': {
                const target = interaction.options.getInteger('target');
                const deskripsi = interaction.options.getString('deskripsi') || 'Donation Goal';

                const goalData = {
                    target: target,
                    description: deskripsi,
                    createdAt: new Date().toISOString(),
                };

                dbHelpers.setSetting.run('donation_goal', JSON.stringify(goalData));

                const stats = dbHelpers.getTotalStats.get();
                const progressBar = createProgressBar(stats.total_amount, target);

                const embed = new EmbedBuilder()
                    .setColor(0x5865F2)
                    .setTitle('🎯 Donation Goal Ditetapkan!')
                    .setDescription(deskripsi)
                    .addFields(
                        { name: '🎯 Target', value: formatRupiah(target), inline: true },
                        { name: '💰 Terkumpul', value: formatRupiah(stats.total_amount), inline: true },
                        { name: '📊 Progress', value: `\`${progressBar}\`` },
                    )
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
                break;
            }

            case 'goal': {
                const goalData = dbHelpers.getSetting.get('donation_goal');
                
                if (!goalData) {
                    await interaction.reply({
                        content: '❌ Belum ada donation goal yang ditetapkan.',
                        ephemeral: true
                    });
                    return;
                }

                const goal = JSON.parse(goalData.value);
                const stats = dbHelpers.getTotalStats.get();
                const progressBar = createProgressBar(stats.total_amount, goal.target);
                const remaining = Math.max(0, goal.target - stats.total_amount);

                const embed = new EmbedBuilder()
                    .setColor(stats.total_amount >= goal.target ? 0x00FF00 : 0xFF6B35)
                    .setTitle(stats.total_amount >= goal.target ? '🎊 Goal Tercapai!' : '🎯 Donation Goal')
                    .setDescription(goal.description)
                    .addFields(
                        { name: '🎯 Target', value: formatRupiah(goal.target), inline: true },
                        { name: '💰 Terkumpul', value: formatRupiah(stats.total_amount), inline: true },
                        { name: '📉 Sisa', value: formatRupiah(remaining), inline: true },
                        { name: '📊 Progress', value: `\`${progressBar}\`` },
                    )
                    .setFooter({ text: `Dari ${stats.total_donors} donatur` })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
                break;
            }

            case 'resetgoal': {
                dbHelpers.setSetting.run('donation_goal', null);
                
                await interaction.reply({
                    content: '✅ Donation goal telah direset.',
                    ephemeral: true
                });
                break;
            }

            // ==================== NEW COMMANDS ====================
            case 'summary': {
                const periode = interaction.options.getString('periode') || 'daily';
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

                if (stats.total_transactions === 0) {
                    await interaction.reply({
                        content: '📋 Tidak ada donasi untuk periode ini.',
                        ephemeral: true
                    });
                    return;
                }

                const leaderboardText = topDonors
                    .map((d, i) => {
                        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
                        return `${medal} **${d.donor_name}** - ${formatRupiah(d.total)}`;
                    })
                    .join('\n');

                const embed = new EmbedBuilder()
                    .setColor(0x00D26A)
                    .setTitle(title)
                    .setDescription(description)
                    .addFields(
                        { name: '💰 Total Terkumpul', value: formatRupiah(stats.total_amount), inline: true },
                        { name: '👥 Jumlah Donatur', value: stats.total_donors.toString(), inline: true },
                        { name: '📊 Total Transaksi', value: stats.total_transactions.toString(), inline: true },
                        { name: '🏆 Top Donatur', value: leaderboardText || 'Tidak ada data' },
                    )
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
                break;
            }

            case 'joinvc': {
                const channelOption = interaction.options.getChannel('channel');
                let voiceChannel = channelOption;

                // Jika tidak ada channel dipilih, coba ambil dari voice channel user
                if (!voiceChannel && interaction.member.voice.channel) {
                    voiceChannel = interaction.member.voice.channel;
                }

                // Atau gunakan VOICE_CHANNEL_ID dari .env
                if (!voiceChannel && VOICE_CHANNEL_ID) {
                    voiceChannel = await client.channels.fetch(VOICE_CHANNEL_ID);
                }

                if (!voiceChannel || voiceChannel.type !== 2) { // 2 = GuildVoice
                    await interaction.reply({
                        content: '❌ Silakan pilih voice channel atau bergabung ke voice channel terlebih dahulu.',
                        ephemeral: true
                    });
                    return;
                }

                const success = await joinVoice(voiceChannel);
                if (success) {
                    await interaction.reply({
                        content: `✅ Bot bergabung ke voice channel **${voiceChannel.name}**. Sound alert akan aktif!`,
                        ephemeral: true
                    });
                } else {
                    await interaction.reply({
                        content: '❌ Gagal bergabung ke voice channel.',
                        ephemeral: true
                    });
                }
                break;
            }

            case 'leavevc': {
                const left = leaveVoice();
                await interaction.reply({
                    content: left ? '✅ Bot telah keluar dari voice channel.' : '❌ Bot tidak sedang di voice channel.',
                    ephemeral: true
                });
                break;
            }

            case 'autosummary': {
                const mode = interaction.options.getString('mode');
                
                if (mode === 'off') {
                    setupAutoSummary('off');
                    await interaction.reply({
                        content: '✅ Auto summary telah dinonaktifkan.',
                        ephemeral: true
                    });
                } else {
                    setupAutoSummary(mode);
                    let modeText = '';
                    if (mode === 'daily') modeText = 'Harian (setiap hari jam 00:00 WIB)';
                    if (mode === 'weekly') modeText = 'Mingguan (setiap Senin jam 00:00 WIB)';
                    if (mode === 'both') modeText = 'Harian & Mingguan';
                    
                    await interaction.reply({
                        content: `✅ Auto summary aktif: **${modeText}**\nSummary akan dikirim ke channel <#${SUMMARY_CHANNEL_ID}>`,
                        ephemeral: true
                    });
                }
                break;
            }
        }
    } catch (error) {
        console.error('❌ Error handling command:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: '❌ Terjadi kesalahan saat memproses perintah.',
                ephemeral: true
            });
        }
    }
});

// ==================== ERROR HANDLING ====================
process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
});

process.on('SIGINT', () => {
    console.log('📴 Menutup database...');
    db.close();
    process.exit(0);
});

// ==================== START BOT ====================
if (!DISCORD_TOKEN) {
    console.error('❌ DISCORD_TOKEN tidak ditemukan di file .env');
    console.log('📋 Silakan isi DISCORD_TOKEN di file .env');
    process.exit(1);
}

client.login(DISCORD_TOKEN);
