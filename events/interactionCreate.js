const { Events } = require('discord.js');
const { handleVehicleButtons, handleSlashCommand } = require('../utils/helpers');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (interaction.isButton()) {
            return handleVehicleButtons(interaction);
        }

        if (interaction.isChatInputCommand()) {
            return handleSlashCommand(interaction);
        }
    },
};
