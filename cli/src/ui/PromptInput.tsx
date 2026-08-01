import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

interface Props {
  onSubmit: (prompt: string) => void;
}

export const PromptInput: React.FC<Props> = ({ onSubmit }) => {
  const [value, setValue] = useState('');

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color="yellow" bold>? </Text>
        <Text bold>Describe the change:</Text>
      </Box>
      <Box marginTop={1} paddingLeft={2}>
        <Text color="cyan">{'> '}</Text>
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={onSubmit}
          placeholder="e.g., make padding larger, change color to red..."
        />
      </Box>
      <Box marginTop={1}>
        <Text color="gray" dimColor>Press Enter to submit</Text>
      </Box>
    </Box>
  );
};
