require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');

// Read all command files from the src/commands directory
const commands = [];
const commandFiles = fs.readdirSync('./src/commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(`./src/commands/${file}`);
  commands.push(command.data.toJSON());
}

// Create REST instance for registering commands
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Registering slash commands to guild...');
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        '1397429767992774676' // replace with your server ID if different
      ),
      { body: commands }
    );
    console.log('✅ Commands registered successfully');
  } catch (error) {
    console.error('Failed to register commands:', error);
  }
})();