// src/rulesEmbed.js
require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

// Configuration
const RULES_CHANNEL_ID = '1399844017172381716';

const client = new Client({
  intents: [ GatewayIntentBits.Guilds ]
});

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}, posting rules embed`);
  const channel = await client.channels.fetch(RULES_CHANNEL_ID);
  if (!channel?.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setTitle('GOAT - Rules')
    .setColor('#9ebaff')  // 6‑digit hex only
    .setDescription(
`__1.__** Be Respectful**
> Treat all members with respect and kindness. Harassment, discrimination, bullying, or any form of offensive content or language is strictly prohibited. Refrain from using harmful, racist, or homophobic slurs towards others.

__2.__** No spamming or advertising**
> No spamming or advertising is allowed. This includes excessive messages, repeated content, emoji floods, unnecessary repeated mentions of users, and sending invites to Discord servers.

__3.__** No NSFW Content**
> NSFW content is not allowed. This includes any adult content in text, images, links, or voice chat.

__4.__** Avoid starting drama**
> Avoid causing drama within the community or engaging in any form of drama in chat and voice channels. Keep interactions respectful and help maintain a positive environment for everyone.

__5.__** Do not attempt to dox or scam others**
> Do not share scam links, malicious content, or links that request or disclose private information. Make sure to respect other people's privacy.

__6.__** Avoid Spoilers**
> Respect others' experiences by refraining from sharing spoilers about games, movies, or other media without proper spoiler warnings. Avoid baiting spoilers to appear as racism.

__7.__** Do not misuse channels**
> Do not misuse any channels. Use each channel only for its intended purpose. Keep all trading-related messages in <#1399843405328027879>.

__8.__** Listen to Staff Members**
> Respect all staff members and their decisions, as they are here to ensure a positive and safe environment for everyone. Staff have the final say in all matters. If you have an issue with a staff member contact a Manager.

__9.__** Scamming**
> Do not attempt to scam or phish other members for personal information, accounts, or virtual items.`
    )
    .setTimestamp();

  await channel.send({ embeds: [embed] });
});

client.login(process.env.DISCORD_TOKEN);