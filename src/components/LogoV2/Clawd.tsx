import * as React from 'react';
import { Box, Text } from '../../ink.js';

export type ClawdPose =
  | 'default'
  | 'arms-up'
  | 'look-left'
  | 'look-right';

type Props = {
  pose?: ClawdPose;
};

const KIMI_ASCII = [
  'K   K III M   M III',
  'K  K   I  MM MM  I ',
  'KKK    I  M M M  I ',
  'K  K   I  M   M  I ',
  'K   K III M   M III',
] as const;

export function Clawd(_props: Props = {}): React.ReactNode {
  return (
    <Box flexDirection="column" alignItems="center">
      {KIMI_ASCII.map(line => (
        <Text key={line} color="clawd_body">
          {line}
        </Text>
      ))}
    </Box>
  );
}
