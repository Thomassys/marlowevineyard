const { SlashCommandBuilder } = require('discord.js');
const { connectDb } = require('../database/connect');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ajouter_vehicule')
        .setDescription('Ajouter un nouveau véhicule')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Type du véhicule')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('serialnumber')
                .setDescription('Numéro de série du véhicule')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('plate')
                .setDescription('Plaque d\'immatriculation')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('imageurl')
                .setDescription('URL de l\'image du véhicule')
                .setRequired(false)),

    async execute(interaction) {
        const db = await connectDb();
        const type = interaction.options.getString('type');
        const serialNumber = interaction.options.getInteger('serialnumber');
        const plate = interaction.options.getString('plate');
        const imageUrl = interaction.options.getString('imageurl') || '';

        await db.query(
            'INSERT INTO vehicles (type, serialNumber, plate, available, lastUsedBy, lastUsedAt, imageUrl) VALUES (?, ?, ?, 1, NULL, NULL, ?)',
            [type, serialNumber, plate, imageUrl]
        );

        await interaction.reply({
            content: `✅ Véhicule **${type} - ${serialNumber}** ajouté avec succès.`,
            ephemeral: true
        });
    }
};
