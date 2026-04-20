import type { Command } from '../../commands.js'

const stats = {
  type: 'local-jsx',
  name: 'stats',
  description: 'Show your Kimi 2.6 Code usage statistics and activity',
  load: () => import('./stats.js'),
} satisfies Command

export default stats
