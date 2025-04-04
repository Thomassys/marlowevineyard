const { SlashCommandBuilder } = require('discord.js');
const { sendVehiclesEmbeds } = require('../utils/helpers');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remorques')
        .setDescription('Afficher uniquement les remorques.'),
    async execute(interaction) {
        await sendVehiclesEmbeds(interaction, 'Graintrailer');
    },
};