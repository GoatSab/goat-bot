// src/ticket.js
require('dotenv').config();
const fs = require('fs');
const {
  Client,
  GatewayIntentBits,
  Collection,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  AttachmentBuilder
} = require('discord.js');

const TICKET_CHANNEL_ID      = '1399127054246477824';
const TICKET_CATEGORY_ID     = '1399872666843873280';
const STAFF_ROLE_ID          = '1399128110774878319';
const TRANSCRIPT_CHANNEL_ID  = '1399878825235447848'; // set your log channel ID here

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// right after your client is created and before you load commands:
const FORUM_CHANNEL_ID = '1399843405328027879'; // your trade‐forum channel ID

client.on('threadCreate', async thread => {
  // only watch threads in your trade forum
  if (thread.parentId !== FORUM_CHANNEL_ID) return;

  // count active threads that this user owns in that forum
  const allThreads = thread.guild.channels.cache.filter(c =>
    c.parentId === FORUM_CHANNEL_ID && c.isThread()
  );
  const userThreads = allThreads.filter(t => t.ownerId === thread.ownerId);

  // if they already had one, delete the new one and DM them
  if (userThreads.size > 1) {
    await thread.delete().catch(() => null);
    const member = await thread.guild.members.fetch(thread.ownerId).catch(() => null);
    if (member) {
      member.send(
        '🚫 You may only have one active trade post at a time.  ' +
        'Please delete your existing thread before creating a new one.'
      ).catch(() => null);
    }
  }
});

// load other slash commands (vouch, vouches, clearvouches, invites)
client.commands = new Collection();
fs.readdirSync(__dirname + '/commands')
  .filter(f => f.endsWith('.js'))
  .forEach(file => {
    const cmd = require(`./commands/${file}`);
    client.commands.set(cmd.data.name, cmd);
  });

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  const channel = await client.channels.fetch(TICKET_CHANNEL_ID);
  if (!channel?.isTextBased()) return;
  
  const embed = new EmbedBuilder()
    .setTitle('Request a Middleman')
    .setDescription('Tired of getting scammed? Keep every trade **SAFE** — request a Middleman!')
    .addFields({ name: '❓ What’s a middleman?', value: 'A trusted staff member who holds both items until trade completes.' })
    .setColor('#5865F2')
    .setFooter({ text: 'TicketTool.xyz – Ticketing without clutter' });

  const button = new ButtonBuilder()
    .setCustomId('open_ticket')
    .setLabel('Request a Middleman')
    .setStyle(ButtonStyle.Primary)
    .setEmoji('🛡️');

  const row = new ActionRowBuilder().addComponents(button);
  await channel.send({ embeds: [embed], components: [row] });
});

client.on('interactionCreate', async interaction => {
  // handle vouch- and invite-related slash commands
  if (interaction.isChatInputCommand()) {
    const cmd = client.commands.get(interaction.commandName);
    if (cmd) {
      try {
        await cmd.execute(interaction);
      } catch (err) {
        console.error(err);
        if (!interaction.replied) {
          await interaction.reply({ content: 'There was an error.', ephemeral: true });
        }
      }
    }
    return;
  }

  // open ticket modal
  if (interaction.isButton() && interaction.customId === 'open_ticket') {
    const modal = new ModalBuilder()
      .setCustomId('ticket_modal')
      .setTitle('Ticket Request');

    const q1 = new TextInputBuilder()
      .setCustomId('q1')
      .setLabel('Who are you trading with?')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const q2 = new TextInputBuilder()
      .setCustomId('q2')
      .setLabel('What is the trade?')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    const q3 = new TextInputBuilder()
      .setCustomId('q3')
      .setLabel('Can you pay the middleman fee? (Yes/No)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const q4 = new TextInputBuilder()
      .setCustomId('q4')
      .setLabel('Can you join private servers? (Yes/No)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(q1),
      new ActionRowBuilder().addComponents(q2),
      new ActionRowBuilder().addComponents(q3),
      new ActionRowBuilder().addComponents(q4)
    );

    await interaction.showModal(modal);
    return;
  }

  // create ticket channel on modal submit
  if (interaction.isModalSubmit() && interaction.customId === 'ticket_modal') {
    await interaction.deferReply({ ephemeral: true });
    const user = interaction.user;
    const answers = {
      tradingWith: interaction.fields.getTextInputValue('q1'),
      tradeWhat:   interaction.fields.getTextInputValue('q2'),
      fee:         interaction.fields.getTextInputValue('q3'),
      joinServer:  interaction.fields.getTextInputValue('q4')
    };

    let ticketChannel;
    try {
      ticketChannel = await interaction.guild.channels.create({
        name: `ticket-${user.username}`.toLowerCase(),
        type: 0,
        parent: TICKET_CATEGORY_ID,
        permissionOverwrites: [
          { id: interaction.guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
          { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          { id: STAFF_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
        ]
      });
    } catch (err) {
      console.error('Error creating ticket channel:', err);
      return interaction.followUp({ content: '❌ Failed to create ticket channel.', ephemeral: true });
    }

    const ticketEmbed = new EmbedBuilder()
      .setTitle(`Ticket for ${user.tag}`)
      .setThumbnail(user.displayAvatarURL())
      .setColor('#5865F2')
      .addFields(
        { name: 'Trading with',       value: answers.tradingWith },
        { name: 'What is the trade?', value: answers.tradeWhat },
        { name: 'Pay middleman fee?', value: answers.fee },
        { name: 'Join private server?', value: answers.joinServer }
      )
      .setTimestamp();

    const closeButton = new ButtonBuilder()
      .setCustomId('close_ticket')
      .setLabel('Close Ticket')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🔒');

    await ticketChannel.send({
      content: `<@${user.id}> opened a ticket`,
      embeds: [ticketEmbed],
      components: [new ActionRowBuilder().addComponents(closeButton)]
    });
    await interaction.followUp({ content: `✅ Your ticket has been created: ${ticketChannel}`, ephemeral: true });
    return;
  }

  // close ticket + post transcript
  if (interaction.isButton() && interaction.customId === 'close_ticket') {
    const channel = interaction.channel;
    const messages = await channel.messages.fetch({ limit: 100 });
    const transcript = messages
      .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
      .map(m => `[${new Date(m.createdTimestamp).toLocaleString()}] ${m.author.tag}: ${m.content}`)
      .join('\n');

    const transcriptChannel = await channel.guild.channels.fetch(TRANSCRIPT_CHANNEL_ID);
    const attachment = new AttachmentBuilder(Buffer.from(transcript, 'utf-8'), {
      name: `${channel.name}-transcript.txt`
    });
    if (transcriptChannel?.isTextBased()) {
      await transcriptChannel.send({ content: `Transcript for ${channel.name}:`, files: [attachment] });
    }

    await channel.delete();
  }
});

client.login(process.env.DISCORD_TOKEN);