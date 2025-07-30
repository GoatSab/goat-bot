// src/commands/vouches.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');

const dbPath     = './vouches.json';
const CHANNEL_ID = '1399867830341472357';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vouches')
    .setDescription('Show a user’s vouch report')
    .addUserOption(o =>
      o.setName('target')
       .setDescription('User to report on')
       .setRequired(true)
    ),

  async execute(interaction) {
    // only in trade channel
    if (interaction.channel.id !== CHANNEL_ID) {
      return interaction.reply({
        content: `You can only use this in <#${CHANNEL_ID}>.`,
        ephemeral: true
      });
    }

    if (!fs.existsSync(dbPath)) {
      return interaction.reply({ content: 'No vouches recorded yet.', ephemeral: true });
    }

    const db     = JSON.parse(fs.readFileSync(dbPath));
    const target = interaction.options.getUser('target');
    const list   = db[target.id] || [];

    if (list.length === 0) {
      return interaction.reply({ content: `${target.tag} has no vouches.`, ephemeral: true });
    }

    // summary stats
    const receivedCount = list.length;
    let givenCount = 0;
    Object.values(db).forEach(arr => {
      arr.forEach(v => {
        if (v.by === target.tag) givenCount++;
      });
    });

    // average rating
    const avgRating = Math.round(
      list.reduce((sum, v) => sum + v.rating, 0) / receivedCount
    );

    // flag malicious if 3 or more 1‑star ratings
    const oneStars      = list.filter(v => v.rating === 1).length;
    const isMalicious   = oneStars >= 3;
    const maliciousValue = isMalicious
      ? '**__<:red_circle:> Yes__**'
      : 'No';

    // account age in days
    const ageDays = Math.floor(
      (Date.now() - target.createdTimestamp) / (1000 * 60 * 60 * 24)
    );

    // build embed
    const embed = new EmbedBuilder()
      .setTitle(`${target.username}’s Vouch Report`)
      .setThumbnail(target.displayAvatarURL())
      .setColor('#2ECC71')
      .addFields(
        { name: 'User rating',       value: '⭐️'.repeat(avgRating), inline: true },
        { name: 'Vouches given',     value: String(givenCount),      inline: true },
        { name: 'Vouches received',  value: String(receivedCount),   inline: true },
        { name: 'Malicious',         value: maliciousValue,          inline: true },
        { name: 'Account age',       value: `${ageDays} days`,        inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
