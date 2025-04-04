const express = require('express');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = 3000;
app.use(bodyParser.json());

const ENTREPRISES = {
  "UwU Café": "<@&1357731513600442620>"
};

function startWebhook(client) {
  app.post('/gforms', async (req, res) => {
    const {entreprise} = req.body;

    const tag = ENTREPRISES[entreprise] || entreprise;

    try {
      const channel = await client.channels.fetch(process.env.DISCORD_CHANNEL_ID);
      await channel.send(`📝 Nouvelle demande reçue de **${entreprise}**\n📌 ${tag}\n👤 Nom : ${nom}\n📧 Email : ${email}`);
      res.sendStatus(200);
    } catch (err) {
      console.error('Erreur en envoyant sur Discord :', err);
      res.sendStatus(500);
    }
  });

  app.listen(PORT, () => console.log(`🚀 Webhook actif sur http://81.49.136.127:${PORT}`));
}

module.exports = { startWebhook };
