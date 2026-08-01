import React from 'react';
import { Box, Text } from 'ink';

interface Props {
  backend: boolean;
  browser: boolean;
}

export const ConnectionStatus: React.FC<Props> = ({ backend, browser }) => {
  return (
    <Box marginBottom={1}>
      <Text color="gray">Status: </Text>
      <Text color={backend ? 'green' : 'red'}>
        {backend ? '● ' : '○ '}Backend
      </Text>
      <Text color="gray"> · </Text>
      <Text color={browser ? 'green' : 'yellow'}>
        {browser ? '● ' : '○ '}Browser
      </Text>
    </Box>
  );
};
