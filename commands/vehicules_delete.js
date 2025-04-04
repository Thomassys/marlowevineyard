const { SlashCommandBuilder } = require('discord.js');
const { connectDb } = require('../database/connect');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('supprimer_vehicule')
        .setDescription('Supprimer un véhicule existant')
        .addIntegerOption(option =>
            option.setName('serialnumber')
                .setDescription('Numéro de série du véhicule à supprimer')
                .setRequired(true)),

    async execute(interaction) {
        const db = await connectDb();
        const serialNumber = interaction.options.getInteger('serialnumber');

        await db.query('DELETE FROM vehicles WHERE serialNumber = ?', [serialNumber]);

        await interaction.reply({
            content: `❌ Véhicule avec le numéro de série **${serialNumber}** supprimé.`,
            ephemeral: true
        });
    }
};
