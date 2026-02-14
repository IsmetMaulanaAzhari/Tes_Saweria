/**
 * Command Handler
 * Menangani semua interaksi slash command
 */

const { EmbedBuilder } = require('discord.js');
const { dbHelpers } = require('../database');
const { formatRupiah, createProgressBar } = require('../utils/helpers');
const { SAWERIA_USERNAME, SUMMARY_CHANNEL_ID, VOICE_CHANNEL_ID } = require('../config');

// Import modules
const { 
    addToBlacklist, 
    removeFromBlacklist, 
    censorMessage, 
    containsBlacklistedWord,
    getBlacklistWords 
} = require('../modules/blacklist');
const { joinVoice, leaveVoice } = require('../modules/voice');
const { setupAutoSummary, getStatsByPeriod } = require('../modules/summary');
const { setGoal, getGoalProgress, resetGoal } = require('../modules/goals');
const { handleDonation, setMinAlertAmount, setMinTTSAmount, getMinAmounts } = require('../modules/donation');
const { 
    generateAnalyticsEmbed,
    generateHourlyChartEmbed,
    generateDailyChartEmbed,
    generateMonthlyTrendEmbed 
} = require('../modules/analytics');
const { 
    setTemplate,
    setTierThreshold,
    resetTemplates,
    generateThankYouMessage,
    generateSettingsEmbed,
    getTier 
} = require('../modules/thankyou');

/**
 * Handle semua slash command interactions
 * @param {Interaction} interaction - Discord interaction
 * @param {Client} client - Discord client
 */
async function handleCommand(interaction, client) {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    try {
        switch (commandName) {
            case 'leaderboard':
                await handleLeaderboard(interaction);
                break;
            
            case 'donasi':
                await handleDonasi(interaction);
                break;
            
            case 'donasihelp':
                await handleDonasiHelp(interaction);
                break;
            
            case 'recentdonasi':
                await handleRecentDonasi(interaction);
                break;
            
            case 'totaldonasi':
                await handleTotalDonasi(interaction);
                break;
            
            case 'testdonasi':
                await handleTestDonasi(interaction);
                break;
            
            case 'setgoal':
                await handleSetGoal(interaction);
                break;
            
            case 'goal':
                await handleGoal(interaction);
                break;
            
            case 'resetgoal':
                await handleResetGoal(interaction);
                break;
            
            case 'summary':
                await handleSummary(interaction);
                break;
            
            case 'joinvc':
                await handleJoinVC(interaction, client);
                break;
            
            case 'leavevc':
                await handleLeaveVC(interaction);
                break;
            
            case 'autosummary':
                await handleAutoSummary(interaction);
                break;
            
            case 'blacklist':
                await handleBlacklist(interaction);
                break;
            
            case 'minalert':
                await handleMinAlert(interaction);
                break;
            
            case 'analytics':
                await handleAnalytics(interaction);
                break;
            
            case 'thankyou':
                await handleThankYou(interaction);
                break;
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
}

// ==================== COMMAND HANDLERS ====================

async function handleLeaderboard(interaction) {
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
}

async function handleDonasi(interaction) {
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
}

async function handleDonasiHelp(interaction) {
    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📖 Bantuan Perintah Bot')
        .setDescription('Daftar semua perintah yang tersedia:')
        .addFields(
            { name: '📊 Informasi', value: 
                '`/leaderboard` - Top donatur\n' +
                '`/recentdonasi` - Donasi terbaru\n' +
                '`/totaldonasi` - Statistik donasi\n' +
                '`/summary` - Rangkuman donasi\n' +
                '`/goal` - Progress donation goal\n' +
                '`/donasi` - Cara berdonasi'
            },
            { name: '🔧 Admin Only', value: 
                '`/testdonasi` - Test notifikasi\n' +
                '`/setgoal` - Set target donasi\n' +
                '`/resetgoal` - Reset goal\n' +
                '`/autosummary` - Atur summary otomatis\n' +
                '`/joinvc` - Bot gabung voice channel\n' +
                '`/leavevc` - Bot keluar voice channel\n' +
                '`/blacklist` - Kelola kata terlarang\n' +
                '`/minalert` - Atur minimum amount alert'
            },
        )
        .setFooter({ text: 'Saweria Discord Bot' })
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleRecentDonasi(interaction) {
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
}

async function handleTotalDonasi(interaction) {
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
}

async function handleTestDonasi(interaction) {
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
}

async function handleSetGoal(interaction) {
    const target = interaction.options.getInteger('target');
    const deskripsi = interaction.options.getString('deskripsi') || 'Donation Goal';

    setGoal(target, deskripsi);

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
}

async function handleGoal(interaction) {
    const progress = getGoalProgress();
    
    if (!progress) {
        await interaction.reply({
            content: '❌ Belum ada donation goal yang ditetapkan.',
            ephemeral: true
        });
        return;
    }

    const embed = new EmbedBuilder()
        .setColor(progress.isComplete ? 0x00FF00 : 0xFF6B35)
        .setTitle(progress.isComplete ? '🎊 Goal Tercapai!' : '🎯 Donation Goal')
        .setDescription(progress.goal.description)
        .addFields(
            { name: '🎯 Target', value: formatRupiah(progress.goal.target), inline: true },
            { name: '💰 Terkumpul', value: formatRupiah(progress.currentAmount), inline: true },
            { name: '📉 Sisa', value: formatRupiah(progress.remaining), inline: true },
            { name: '📊 Progress', value: `\`${progress.progressBar}\`` },
        )
        .setFooter({ text: `Dari ${progress.totalDonors} donatur` })
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleResetGoal(interaction) {
    resetGoal();
    
    await interaction.reply({
        content: '✅ Donation goal telah direset.',
        ephemeral: true
    });
}

async function handleSummary(interaction) {
    const periode = interaction.options.getString('periode') || 'daily';
    const { stats, topDonors, title, description } = getStatsByPeriod(periode);

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
}

async function handleJoinVC(interaction, client) {
    const channelOption = interaction.options.getChannel('channel');
    let voiceChannel = channelOption;

    // Jika tidak ada channel dipilih, coba ambil dari voice channel user
    if (!voiceChannel && interaction.member.voice.channel) {
        voiceChannel = interaction.member.voice.channel;
    }

    // Atau gunakan VOICE_CHANNEL_ID dari config
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
}

async function handleLeaveVC(interaction) {
    const left = leaveVoice();
    await interaction.reply({
        content: left ? '✅ Bot telah keluar dari voice channel.' : '❌ Bot tidak sedang di voice channel.',
        ephemeral: true
    });
}

async function handleAutoSummary(interaction) {
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
}

async function handleBlacklist(interaction) {
    const subcommand = interaction.options.getSubcommand();
    
    if (subcommand === 'add') {
        const kata = interaction.options.getString('kata');
        const words = kata.split(/[,\s]+/).filter(w => w.length >= 2);
        
        if (words.length === 0) {
            await interaction.reply({
                content: '❌ Kata harus minimal 2 karakter.',
                ephemeral: true
            });
            return;
        }
        
        words.forEach(word => addToBlacklist(word, interaction.user.tag));
        
        await interaction.reply({
            content: `✅ Berhasil menambahkan ${words.length} kata ke blacklist:\n\`${words.join(', ')}\``,
            ephemeral: true
        });
    }
    
    else if (subcommand === 'remove') {
        const kata = interaction.options.getString('kata');
        const words = kata.split(/[,\s]+/).filter(w => w.length >= 2);
        
        words.forEach(word => removeFromBlacklist(word));
        
        await interaction.reply({
            content: `✅ Berhasil menghapus kata dari blacklist:\n\`${words.join(', ')}\``,
            ephemeral: true
        });
    }
    
    else if (subcommand === 'list') {
        const blacklistWords = getBlacklistWords();
        const wordArray = Array.from(blacklistWords).sort();
        
        if (wordArray.length === 0) {
            await interaction.reply({
                content: '📝 Tidak ada kata dalam blacklist.',
                ephemeral: true
            });
            return;
        }
        
        // Split into chunks if too long
        const chunkSize = 50;
        const chunks = [];
        for (let i = 0; i < wordArray.length; i += chunkSize) {
            chunks.push(wordArray.slice(i, i + chunkSize));
        }
        
        const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('🚫 Daftar Kata Terlarang')
            .setDescription(`Total: **${wordArray.length}** kata`)
            .addFields(
                chunks.slice(0, 5).map((chunk, i) => ({
                    name: `Kata ${i * chunkSize + 1}-${Math.min((i + 1) * chunkSize, wordArray.length)}`,
                    value: `\`${chunk.join('`, `')}\``
                }))
            )
            .setFooter({ text: 'Gunakan /blacklist add atau /blacklist remove untuk mengelola' })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
    
    else if (subcommand === 'test') {
        const teks = interaction.options.getString('teks');
        const filtered = censorMessage(teks);
        const hasBlacklisted = containsBlacklistedWord(teks);
        
        const embed = new EmbedBuilder()
            .setColor(hasBlacklisted ? 0xFF0000 : 0x00FF00)
            .setTitle(hasBlacklisted ? '🚫 Kata Terlarang Terdeteksi' : '✅ Tidak Ada Kata Terlarang')
            .addFields(
                { name: '📝 Teks Asli', value: `\`\`\`${teks}\`\`\`` },
                { name: '🔒 Hasil Filter', value: `\`\`\`${filtered}\`\`\`` }
            )
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
}

async function handleMinAlert(interaction) {
    const subcommand = interaction.options.getSubcommand();
    
    if (subcommand === 'set') {
        const jumlah = interaction.options.getInteger('jumlah');
        setMinAlertAmount(jumlah);
        
        const embed = new EmbedBuilder()
            .setColor(0x00D26A)
            .setTitle('✅ Minimum Alert Amount Diubah')
            .setDescription(jumlah === 0 
                ? 'Semua donasi akan ditampilkan di Discord.'
                : `Hanya donasi **${formatRupiah(jumlah)}** atau lebih yang akan ditampilkan.`)
            .addFields(
                { name: '💰 Minimum Amount', value: formatRupiah(jumlah), inline: true }
            )
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
    
    else if (subcommand === 'tts') {
        const jumlah = interaction.options.getInteger('jumlah');
        setMinTTSAmount(jumlah);
        
        const embed = new EmbedBuilder()
            .setColor(0x00D26A)
            .setTitle('✅ Minimum TTS Amount Diubah')
            .setDescription(jumlah === 0 
                ? 'Semua donasi akan dibacakan TTS.'
                : `Hanya donasi **${formatRupiah(jumlah)}** atau lebih yang akan dibacakan TTS.`)
            .addFields(
                { name: '🗣️ Minimum TTS', value: formatRupiah(jumlah), inline: true }
            )
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
    
    else if (subcommand === 'status') {
        const { minAlert, minTTS } = getMinAmounts();
        
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('⚙️ Status Minimum Amount')
            .addFields(
                { 
                    name: '📢 Min. Alert (Discord)', 
                    value: minAlert === 0 ? 'Semua donasi' : formatRupiah(minAlert), 
                    inline: true 
                },
                { 
                    name: '🗣️ Min. TTS (Voice)', 
                    value: minTTS === 0 ? 'Semua donasi' : formatRupiah(minTTS), 
                    inline: true 
                }
            )
            .setDescription('Donasi di bawah minimum tetap tercatat di database.')
            .setFooter({ text: 'Gunakan /minalert set atau /minalert tts untuk mengubah' })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
}

// ==================== ANALYTICS HANDLER ====================

async function handleAnalytics(interaction) {
    const view = interaction.options.getString('view') || 'dashboard';
    
    let embed;
    
    switch (view) {
        case 'hourly':
            embed = generateHourlyChartEmbed();
            break;
        case 'daily':
            embed = generateDailyChartEmbed();
            break;
        case 'monthly':
            embed = generateMonthlyTrendEmbed();
            break;
        case 'dashboard':
        default:
            embed = generateAnalyticsEmbed();
            break;
    }
    
    await interaction.reply({ embeds: [embed] });
}

// ==================== THANK YOU HANDLER ====================

async function handleThankYou(interaction) {
    const subcommand = interaction.options.getSubcommand();
    
    if (subcommand === 'settings') {
        const embed = generateSettingsEmbed();
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
    
    else if (subcommand === 'set') {
        const tier = interaction.options.getString('tier');
        const template = interaction.options.getString('template');
        
        setTemplate(tier, template);
        
        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Template Updated')
            .setDescription(`Template untuk tier **${tier}** berhasil diubah!`)
            .addFields({ name: '📝 Template Baru', value: `\`\`\`${template}\`\`\`` })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
    
    else if (subcommand === 'tier') {
        const tier = interaction.options.getString('tier');
        const jumlah = interaction.options.getInteger('jumlah');
        
        setTierThreshold(tier, jumlah);
        
        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Tier Threshold Updated')
            .setDescription(`Threshold untuk tier **${tier}** diubah menjadi **${formatRupiah(jumlah)}**`)
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
    
    else if (subcommand === 'reset') {
        resetTemplates();
        
        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle('🔄 Templates Reset')
            .setDescription('Semua template terima kasih telah di-reset ke default.')
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
    
    else if (subcommand === 'preview') {
        const tier = interaction.options.getString('tier');
        
        // Create sample donation for preview
        const sampleDonation = {
            donator: 'SampleDonatur',
            amount: tier === 'small' ? 10000 : tier === 'medium' ? 75000 : 150000,
            message: 'Ini adalah contoh pesan donasi!'
        };
        
        const isMilestone = tier === 'milestone';
        const message = generateThankYouMessage(sampleDonation, isMilestone);
        
        // Color based on tier
        const colors = {
            small: 0x00FF00,
            medium: 0xFFD700,
            large: 0xFF6B35,
            milestone: 0xFF00FF
        };
        
        const embed = new EmbedBuilder()
            .setColor(colors[tier] || 0x00FF00)
            .setTitle(`🔍 Preview: ${tier.charAt(0).toUpperCase() + tier.slice(1)}`)
            .setDescription(message)
            .addFields(
                { name: '📝 Sample Data', value: 
                    `**Nama:** ${sampleDonation.donator}\n` +
                    `**Amount:** ${formatRupiah(sampleDonation.amount)}\n` +
                    `**Pesan:** ${sampleDonation.message}`
                }
            )
            .setFooter({ text: 'Ini adalah preview - bukan donasi asli' })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
}

module.exports = {
    handleCommand,
};
