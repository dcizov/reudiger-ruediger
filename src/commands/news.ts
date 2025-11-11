import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';

import {
  AVAILABLE_NEWS_SOURCES,
  getNewsSourceStatus,
  toggleNewsSource,
  type NewsSourceKey,
} from '../services/newsService';
import type { SubcommandCommand } from '../types/command';

export const news: SubcommandCommand = {
  data: new SlashCommandBuilder()
    .setName('news')
    .setDescription('Admin: Configure news sources')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('list')
        .setDescription('List all available news sources and their status'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('enable')
        .setDescription('Enable a news source')
        .addStringOption((option) =>
          option
            .setName('source')
            .setDescription('News source to enable')
            .setRequired(true)
            .addChoices(
              ...Object.entries(AVAILABLE_NEWS_SOURCES).map(
                ([key, source]) => ({
                  name: `${source.icon} ${source.name}`,
                  value: key,
                }),
              ),
            ),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('disable')
        .setDescription('Disable a news source')
        .addStringOption((option) =>
          option
            .setName('source')
            .setDescription('News source to disable')
            .setRequired(true)
            .addChoices(
              ...Object.entries(AVAILABLE_NEWS_SOURCES).map(
                ([key, source]) => ({
                  name: `${source.icon} ${source.name}`,
                  value: key,
                }),
              ),
            ),
        ),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
      await interaction.reply({
        content: '❌ This command can only be used in a server.',
        ephemeral: true,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'list':
        return handleList(interaction);
      case 'enable':
        return handleToggle(interaction, true);
      case 'disable':
        return handleToggle(interaction, false);
      default:
        await interaction.reply({
          content: '❌ Unknown subcommand.',
          ephemeral: true,
        });
    }
  },
};

async function handleList(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) return;

  await interaction.deferReply({ ephemeral: true });

  const status = await getNewsSourceStatus(interaction.guildId);

  // Group by category
  const gamesSources: string[] = [];
  const wowSources: string[] = [];

  for (const [key, source] of Object.entries(AVAILABLE_NEWS_SOURCES)) {
    const enabled = status[key] ?? true;
    const statusIcon = enabled ? '✅' : '❌';
    const line = `${statusIcon} ${source.icon} **${source.name}** - ${source.description}`;

    if (source.category === 'Games') {
      gamesSources.push(line);
    } else if (source.category === 'World of Warcraft') {
      wowSources.push(line);
    }
  }

  const embed = new EmbedBuilder()
    .setTitle('📰 News Sources Configuration')
    .setDescription('Manage which news sources post to your server')
    .setColor(0x5865f2)
    .addFields(
      {
        name: '🎮 Games',
        value: gamesSources.join('\n') || 'None',
      },
      {
        name: '🏰 World of Warcraft',
        value: wowSources.join('\n') || 'None',
      },
      {
        name: '💡 How to Configure',
        value: [
          '`/news enable <source>` - Enable a news source',
          '`/news disable <source>` - Disable a news source',
          '\n**Note:** Changes take effect on the next hourly check',
        ].join('\n'),
      },
    )
    .setFooter({ text: 'News posts check hourly' });

  await interaction.editReply({ embeds: [embed] });
}

async function handleToggle(
  interaction: ChatInputCommandInteraction,
  enabled: boolean,
) {
  if (!interaction.guildId) return;

  const sourceKey = interaction.options.getString(
    'source',
    true,
  ) as NewsSourceKey;
  const source = AVAILABLE_NEWS_SOURCES[sourceKey];

  if (!source) {
    await interaction.reply({
      content: '❌ Invalid news source.',
      ephemeral: true,
    });
    return;
  }

  await toggleNewsSource(interaction.guildId, sourceKey, enabled);

  await interaction.reply({
    content: `${enabled ? '✅' : '❌'} ${source.icon} **${source.name}** has been ${enabled ? 'enabled' : 'disabled'}.\n\nChanges will take effect on the next news check (hourly).`,
    ephemeral: true,
  });
}
