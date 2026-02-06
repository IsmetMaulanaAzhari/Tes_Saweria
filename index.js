require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { io } = require('socket.io-client');

// ==================== KONFIGURASI ====================
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const SAWERIA_STREAM_KEY = process.env.SAWERIA_STREAM_KEY;

// ==================== DATABASE DONASI (In-Memory) ====================
// Untuk produksi, gunakan database seperti MongoDB, SQLite, dll.
const donations = [];
const leaderboard = new Map(); // { donorName: totalAmount }

// ==================== DISCORD CLIENT ====================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
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

function updateLeaderboard(donorName, amount) {
    const currentTotal = leaderboard.get(donorName) || 0;
    leaderboard.set(donorName, currentTotal + amount);
}

function getTopDonors(limit = 10) {
    return Array.from(leaderboard.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);
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
        // Join dengan stream key
        socket.emit('join', SAWERIA_STREAM_KEY);
    });

    socket.on('disconnect', () => {
        console.log('⚠️ Terputus dari Saweria Socket, mencoba menghubungkan kembali...');
    });

    socket.on('donations', async (data) => {
        console.log('💰 Donasi diterima:', data);
        await handleDonation(data);
    });

    socket.on('error', (error) => {
        console.error('❌ Error Saweria Socket:', error);
    });
}

// ==================== HANDLE DONASI ====================
async function handleDonation(data) {
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
            media: data.media || null,
            timestamp: new Date(),
        };

        // Simpan ke database
        donations.push(donation);
        updateLeaderboard(donation.donorName, donation.amount);

        // Buat embed notifikasi
        const embed = new EmbedBuilder()
            .setColor(0xFF6B35) // Warna orange Saweria
            .setTitle('🎉 Donasi Baru!')
            .setDescription(`**${donation.donorName}** telah berdonasi!`)
            .addFields(
                { name: '💵 Jumlah', value: formatRupiah(donation.amount), inline: true },
                { name: '📅 Waktu', value: `<t:${Math.floor(donation.timestamp.getTime() / 1000)}:R>`, inline: true },
            )
            .setThumbnail('https://saweria.co/favicon.ico')
            .setFooter({ text: 'Terima kasih atas dukungannya! 💖' })
            .setTimestamp();

        // Tambahkan pesan donatur jika ada
        if (donation.message) {
            embed.addFields({ name: '💬 Pesan', value: donation.message });
        }

        await channel.send({ embeds: [embed] });
        console.log('✅ Notifikasi donasi terkirim ke Discord');
    } catch (error) {
        console.error('❌ Error mengirim notifikasi:', error);
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
    client.user.setActivity('donasi | /donasihelp', { type: 3 }); // Watching
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    try {
        switch (commandName) {
            case 'leaderboard': {
                const limit = interaction.options.getInteger('jumlah') || 10;
                const topDonors = getTopDonors(limit);
                
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
                        return `${medal} **${donor[0]}** - ${formatRupiah(donor[1])}`;
                    })
                    .join('\n');

                const embed = new EmbedBuilder()
                    .setColor(0xFFD700)
                    .setTitle('🏆 Top Donatur')
                    .setDescription(leaderboardText)
                    .setFooter({ text: `Total ${leaderboard.size} donatur` })
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
                        { name: '🔗 Link Donasi', value: 'https://saweria.co/USERNAME_KAMU' },
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
                        { name: '/leaderboard [jumlah]', value: 'Tampilkan top donatur' },
                        { name: '/donasi', value: 'Informasi cara berdonasi' },
                        { name: '/recentdonasi [jumlah]', value: 'Tampilkan donasi terbaru' },
                        { name: '/totaldonasi', value: 'Tampilkan total donasi terkumpul' },
                        { name: '/donasihelp', value: 'Tampilkan pesan bantuan ini' },
                    )
                    .setFooter({ text: 'Saweria Discord Bot' })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
                break;
            }

            case 'recentdonasi': {
                const limit = interaction.options.getInteger('jumlah') || 5;
                const recentDonations = donations.slice(-limit).reverse();

                if (recentDonations.length === 0) {
                    await interaction.reply({
                        content: '📋 Belum ada donasi yang tercatat.',
                        ephemeral: true
                    });
                    return;
                }

                const donationList = recentDonations
                    .map((d, i) => `${i + 1}. **${d.donorName}** - ${formatRupiah(d.amount)}\n   └ ${d.message || 'Tidak ada pesan'}`)
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
                const totalAmount = donations.reduce((sum, d) => sum + d.amount, 0);
                const totalDonors = leaderboard.size;
                const totalCount = donations.length;

                const embed = new EmbedBuilder()
                    .setColor(0x00D26A)
                    .setTitle('💰 Statistik Donasi')
                    .addFields(
                        { name: '💵 Total Terkumpul', value: formatRupiah(totalAmount), inline: true },
                        { name: '👥 Jumlah Donatur', value: totalDonors.toString(), inline: true },
                        { name: '📊 Total Transaksi', value: totalCount.toString(), inline: true },
                    )
                    .setFooter({ text: 'Terima kasih kepada semua donatur! 💖' })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
                break;
            }
        }
    } catch (error) {
        console.error('❌ Error handling command:', error);
        await interaction.reply({
            content: '❌ Terjadi kesalahan saat memproses perintah.',
            ephemeral: true
        });
    }
});

// ==================== ERROR HANDLING ====================
process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
});

// ==================== START BOT ====================
if (!DISCORD_TOKEN) {
    console.error('❌ DISCORD_TOKEN tidak ditemukan di file .env');
    console.log('📋 Silakan isi DISCORD_TOKEN di file .env');
    process.exit(1);
}

client.login(DISCORD_TOKEN);
