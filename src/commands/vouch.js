const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const dbPath = './vouches.json';

const STAFF_ROLES = ['Head Admin', 'Staff'];
const CHANNEL_ID   = '1399867830341472357';
const COOLDOWN_MS  = 180 * 60 * 1000;      // 3 hours
const MIN_ACCOUNT_AGE = 14 * 24 * 60 * 60 * 1000; // 14 days
const cooldowns = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vouch')
    .setDescription('Give a vouch to a user')
    .addUserOption(o => o
      .setName('target')
      .setDescription('User to vouch')
      .setRequired(true))
    .addStringOption(o => o
      .setName('info')
      .setDescription('What the vouch is for')
      .setRequired(true))
    .addIntegerOption(o => o
      .setName('rating')
      .setDescription('Rate the trade (1–5)')
      .setRequired(true)
      .addChoices(
        { name: '⭐️',   value: 1 },
        { name: '⭐️⭐️', value: 2 },
        { name: '⭐️⭐️⭐️', value: 3 },
        { name: '⭐️⭐️⭐️⭐️', value: 4 },
        { name: '⭐️⭐️⭐️⭐️⭐️', value: 5 }
      )),
    
  async execute(interaction) {
    // only in trade channel
    if (interaction.channel.id !== CHANNEL_ID) {
      return interaction.reply({ content: `Use this only in <#${CHANNEL_ID}>.`, ephemeral: true });
    }

    const voucherId = interaction.user.id;
    const target    = interaction.options.getUser('target');

    // prevent self-vouch
    if (target.id === voucherId) {
      return interaction.reply({ content: `You can’t vouch yourself.`, ephemeral: true });
    }

    // staff bypass and cooldown
    const isStaff = interaction.member.roles.cache
      .some(r => STAFF_ROLES.includes(r.name));
    const now = Date.now();
    if (!isStaff) {
      const last = cooldowns.get(voucherId) || 0;
      if (now - last < COOLDOWN_MS) {
        const rem = Math.ceil((COOLDOWN_MS - (now - last)) / 60000);
        return interaction.reply({ content: `Wait ${rem} more minute(s) before vouching again.`, ephemeral: true });
      }
    }

    // account age check
    if (now - interaction.user.createdTimestamp < MIN_ACCOUNT_AGE) {
      return interaction.reply({ content: 'Your account must be 14+ days old to vouch.', ephemeral: true });
    }

    // record the vouch
    const info   = interaction.options.getString('info');
    const rating = interaction.options.getInteger('rating');
    const byTag  = interaction.user.tag;

    let db = fs.existsSync(dbPath)
      ? JSON.parse(fs.readFileSync(dbPath))
      : {};
    if (!db[target.id]) db[target.id] = [];
    db[target.id].push({ by: byTag, info, rating, date: new Date().toISOString() });
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

    if (!isStaff) cooldowns.set(voucherId, now);

    // confirmation embed
    const embed = new EmbedBuilder()
      .setTitle('Vouch Recorded')
      .setColor('#27AE60')
      .setDescription(`You vouched for **${target.tag}**`)
      .addFields(
        { name: 'Vouched by', value: byTag, inline: true },
        { name: 'Rating',     value: '⭐️'.repeat(rating), inline: true },
        { name: 'Details',    value: info }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};