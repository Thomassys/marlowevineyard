const { SlashCommandBuilder } = require('discord.js');
const { sendVehiclesEmbeds } = require('../utils/helpers');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vehicules_autres')
        .setDescription('Afficher tous les autres véhicules (hors tracteurs et remorques).'),
    async execute(interaction) {
        await sendVehiclesEmbeds(interaction, 'autres');
    },
};
