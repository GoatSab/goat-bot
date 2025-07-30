// src/stats.js
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

// Configuration
const GUILD_ID            = '1397429767992774676';
const MEMBERS_CHANNEL_ID  = '1399890841186861206'; // voice channel to show member count
const GOAL_CHANNEL_ID     = '1399890934753267902'; // voice channel to show goal
const MEMBER_GOAL         = 250;                   // your goal number

// Create a lightweight client
const client = new Client({ intents: [ GatewayIntentBits.Guilds ] });

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}, starting stats updater`);

  const updateStats = async () => {
    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) return;
    const count = guild.memberCount;

    try {
      // update members channel
      const memChan = await client.channels.fetch(MEMBERS_CHANNEL_ID);
      if (memChan?.setName) {
        await memChan.setName(`👥 MEMBERS: ${count.toLocaleString()}`);
      }

      // update goal channel
      const goalChan = await client.channels.fetch(GOAL_CHANNEL_ID);
      if (goalChan?.setName) {
        await goalChan.setName(`🔥 GOAL: ${MEMBER_GOAL.toLocaleString()}`);
      }

      console.log(`Stats updated: MEMBERS=${count}, GOAL=${MEMBER_GOAL}`);
    } catch (err) {
      console.error('Error updating stats channels:', err);
    }
  };

  // run immediately, then every 5 minutes
  updateStats();
  setInterval(updateStats, 5 * 60 * 1000);
});

client.login(process.env.DISCORD_TOKEN);