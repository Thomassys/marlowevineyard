const { SlashCommandBuilder } = require('discord.js');
const { sendVehiclesEmbeds } = require('../utils/helpers');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vehicules')
        .setDescription('Afficher tous les véhicules.'),
    async execute(interaction) {
        await sendVehiclesEmbeds(interaction);
    },
};
