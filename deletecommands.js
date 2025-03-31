const { REST, Routes } = require('discord.js');
require('dotenv').config();

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('Suppression des commandes en cours...');
        const commands = await rest.get(Routes.applicationCommands(process.env.CLIENT_ID));

        for (const command of commands) {
            await rest.delete(Routes.applicationCommand(process.env.CLIENT_ID, command.id));
            console.log(`Commande supprimée : ${command.name}`);
        }

        console.log('Toutes les commandes ont été supprimées.');
    } catch (error) {
        console.error(error);
    }
})();
