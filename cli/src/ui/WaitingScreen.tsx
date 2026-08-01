import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';

export const WaitingScreen: React.FC = () => {
  return (
    <Box flexDirection="column" paddingY={1}>
      <Box>
        <Text color="cyan">
          <Spinner type="dots" />
        </Text>
        <Text> Waiting for element selection...</Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text color="gray">Instructions:</Text>
        <Text color="gray">  1. Open your app in the browser</Text>
        <Text color="gray">  2. Press Cmd+Shift+E to enable overlay</Text>
        <Text color="gray">  3. Click any element to select it</Text>
      </Box>

      <Box marginTop={1}>
        <Text color="gray" dimColor>Press Ctrl+C to exit</Text>
      </Box>
    </Box>
  );
};
