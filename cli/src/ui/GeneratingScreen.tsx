import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';

interface Props {
  prompt: string;
}

export const GeneratingScreen: React.FC<Props> = ({ prompt }) => {
  return (
    <Box flexDirection="column" marginTop={1} paddingY={1}>
      <Box>
        <Text color="cyan">
          <Spinner type="dots" />
        </Text>
        <Text bold> Claude Code is generating changes...</Text>
      </Box>

      <Box marginTop={1} paddingLeft={2}>
        <Text color="gray">Request: </Text>
        <Text italic>"{prompt}"</Text>
      </Box>

      <Box marginTop={1} paddingLeft={2}>
        <Text color="gray" dimColor>This usually takes 5-15 seconds...</Text>
      </Box>
    </Box>
  );
};
