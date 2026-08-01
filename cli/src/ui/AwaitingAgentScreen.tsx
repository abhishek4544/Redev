import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { AgentInstructions } from '../types/index.js';

interface Props {
  prompt: string;
  instructions: AgentInstructions;
}

export const AwaitingAgentScreen: React.FC<Props> = ({ prompt, instructions }) => {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color="cyan">
          <Spinner type="dots" />
        </Text>
        <Text bold> Waiting for Claude Code to handle the request...</Text>
      </Box>

      <Box marginTop={1} paddingLeft={2}>
        <Text color="gray">Request: </Text>
        <Text italic>"{prompt}"</Text>
      </Box>

      <Box marginTop={1} paddingLeft={2}>
        <Text color="gray">Request ID: </Text>
        <Text color="yellow">{instructions.requestId}</Text>
      </Box>

      <Box marginTop={2} flexDirection="column" borderStyle="round" borderColor="magenta" paddingX={2} paddingY={1}>
        <Text bold color="magenta">👉 In your Claude Code terminal, paste this:</Text>
        <Box marginTop={1} paddingLeft={2}>
          <Text color="cyan">{instructions.promptForAgent}</Text>
        </Box>
      </Box>

      <Box marginTop={1} paddingLeft={2} flexDirection="column">
        <Text color="gray" dimColor>Redev is watching for .redev/completed.json</Text>
        <Text color="gray" dimColor>Times out in 5 minutes if no response</Text>
      </Box>
    </Box>
  );
};
