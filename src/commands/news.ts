import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';

import {
  AVAILABLE_NEWS_SOURCES,
  checkGameNews,
  getNewsSourceStatus,
  toggleNewsSource,
  type NewsSourceKey,
} from '../services/newsService.js';
import type { SubcommandCommand } from './index.js';

export default {
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
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('check')
        .setDescription('Manually check for news now (ignores posted cache)')
        .addStringOption((option) =>
          option
            .setName('source')
            .setDescription('Check only this source (optional)')
            .setRequired(false)
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
        flags: MessageFlags.Ephemeral,
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
      case 'check':
        return handleCheck(interaction);
      default:
        await interaction.reply({
          content: '❌ Unknown subcommand.',
          flags: MessageFlags.Ephemeral,
        });
    }
  },
} satisfies SubcommandCommand;

async function handleList(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) return;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const status = await getNewsSourceStatus(interaction.guildId);

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
          '`/news check [source]` - Manually check for news now',
          '\n**Note:** Regular checks run every 15 minutes',
        ].join('\n'),
      },
    )
    .setFooter({ text: 'News posts check every 15 minutes' });

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
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await toggleNewsSource(interaction.guildId, sourceKey, enabled);

  await interaction.reply({
    content: `${enabled ? '✅' : '❌'} ${source.icon} **${source.name}** has been ${enabled ? 'enabled' : 'disabled'}.\n\nChanges will take effect on the next news check.`,
    flags: MessageFlags.Ephemeral,
  });
}

async function handleCheck(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) return;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const sourceKey = interaction.options.getString('source', false);
  const source = sourceKey
    ? AVAILABLE_NEWS_SOURCES[sourceKey as NewsSourceKey]
    : null;

  const statusMessage = sourceKey
    ? `🔍 Checking **${source?.name}** for new articles...`
    : '🔍 Checking all enabled news sources...';

  await interaction.editReply({ content: statusMessage });

  try {
    const posted = await checkGameNews(
      interaction.client,
      interaction.guildId,
      sourceKey as NewsSourceKey | undefined,
    );

    if (posted === 0) {
      await interaction.editReply({
        content: `✅ News check complete!\n\n📭 No new articles found${sourceKey ? ` for **${source?.name}**` : ''}.${sourceKey ? '\n\n💡 **Tip:** Recent articles may have already been posted. The bot tracks posted articles to avoid duplicates.' : ''}`,
      });
    } else {
      await interaction.editReply({
        content: `✅ News check complete!\n\n📰 Posted **${posted}** new article${posted > 1 ? 's' : ''}${sourceKey ? ` from **${source?.name}**` : ''}.`,
      });
    }
  } catch (error) {
    await interaction.editReply({
      content: `❌ Error checking news: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}
