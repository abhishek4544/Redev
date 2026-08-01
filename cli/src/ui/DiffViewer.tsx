import React from 'react';
import { Box, Text } from 'ink';
import type { CodeChange } from '../types/index.js';

interface Props {
  changes: CodeChange[];
}

export const DiffViewer: React.FC<Props> = ({ changes }) => {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Box marginBottom={1}>
        <Text bold color="yellow">📝 Proposed Changes:</Text>
      </Box>

      {changes.map((change, i) => (
        <Box key={i} flexDirection="column" borderStyle="round" borderColor="gray" padding={1} marginBottom={1}>
          <Box>
            <Text color="cyan" bold>{change.file}</Text>
            <Text color="gray">:</Text>
            <Text color="yellow">{change.line}</Text>
          </Box>

          <Box marginTop={1} flexDirection="column">
            <Box>
              <Text color="red">- </Text>
              <Text color="red">{change.before}</Text>
            </Box>
            <Box>
              <Text color="green">+ </Text>
              <Text color="green">{change.after}</Text>
            </Box>
          </Box>
        </Box>
      ))}
    </Box>
  );
};
