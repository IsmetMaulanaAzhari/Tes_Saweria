/**
 * Slash Commands Definition
 * Semua command Discord didefinisikan di sini
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const commands = [
    // ==================== INFO COMMANDS ====================
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
    
    // ==================== GOAL COMMANDS ====================
    new SlashCommandBuilder()
        .setName('goal')
        .setDescription('Tampilkan progress donation goal'),
    
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
        .setName('resetgoal')
        .setDescription('Reset donation goal (Admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    // ==================== SUMMARY COMMANDS ====================
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
    
    // ==================== VOICE COMMANDS ====================
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
    
    // ==================== TEST COMMANDS ====================
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
    
    // ==================== BLACKLIST COMMANDS ====================
    new SlashCommandBuilder()
        .setName('blacklist')
        .setDescription('Kelola kata terlarang (Admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Tambah kata ke blacklist')
                .addStringOption(option =>
                    option.setName('kata')
                        .setDescription('Kata yang ingin diblokir')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Hapus kata dari blacklist')
                .addStringOption(option =>
                    option.setName('kata')
                        .setDescription('Kata yang ingin dihapus')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Tampilkan daftar kata terlarang')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('test')
                .setDescription('Test filter pada teks')
                .addStringOption(option =>
                    option.setName('teks')
                        .setDescription('Teks untuk ditest')
                        .setRequired(true)
                )
        ),
];

module.exports = commands;
