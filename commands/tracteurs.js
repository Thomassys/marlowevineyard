const { SlashCommandBuilder } = require('discord.js');
const { sendVehiclesEmbeds } = require('../utils/helpers');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tracteurs')
        .setDescription('Afficher uniquement les tracteurs.'),
    async execute(interaction) {
        await sendVehiclesEmbeds(interaction, 'Tractor2');
    },
};