import React from 'react';
import { Box, Text } from 'ink';

export const Header: React.FC = () => {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box borderStyle="round" borderColor="yellow" paddingX={2}>
        <Text bold color="yellow">
          🥔 Redev
        </Text>
        <Text color="gray"> — Click to Edit for Claude Code</Text>
      </Box>
    </Box>
  );
};
