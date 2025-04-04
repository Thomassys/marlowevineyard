const express = require('express');
require('dotenv').config();

const app = express();
const PORT = 3009;

app.use(express.json());

function startWebhook(client) {
  app.post('/gforms', async (req, res) => {
    console.log('👉 Requête reçue (headers):', req.headers);
    console.log('👉 Body brut reçu :', req.body);

    if (!req.body || typeof req.body !== 'object') {
      console.warn('❌ Aucun body reçu ou type invalide :', req.body);
      return res.status(400).send('Aucune donnée reçue.');
    }

    const { entreprise } = req.body;

    if (!entreprise) {
      return res.status(400).send('⚠️ Le champ "entreprise" est manquant.');
    }

    try {
      const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID);
      await guild.roles.fetch(); // assure le cache des rôles

      const role = guild.roles.cache.find(r => r.name.toLowerCase() === entreprise.toLowerCase());

      const tag = role ? `<@&${role.id}>` : entreprise;

      const channel = await client.channels.fetch(process.env.DISCORD_CHANNEL_ID);
      await channel.send({
        content: `📝 Nouvelle demande reçue de **${entreprise}**\n📌 ${tag}`,
        allowedMentions: role ? { roles: [role.id] } : { parse: [] }
      });

      res.sendStatus(200);
    } catch (err) {
      console.error('❌ Erreur en envoyant sur Discord :', err);
      res.sendStatus(500);
    }
  });

  app.listen(PORT, () => console.log(`🚀 Webhook actif sur http://localhost:${PORT}`));
}

module.exports = { startWebhook };
