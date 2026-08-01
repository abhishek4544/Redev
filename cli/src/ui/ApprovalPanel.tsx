import React from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';

export type ApprovalChoice = 'accept' | 'reject' | 'edit' | 'reselect';

interface Props {
  onSelect: (choice: ApprovalChoice) => void;
}

const items: Array<{ label: string; value: ApprovalChoice }> = [
  { label: '✓ Accept - Apply this change', value: 'accept' },
  { label: '✎ Edit - Refine the description', value: 'edit' },
  { label: '↻ Reselect - Pick a different element', value: 'reselect' },
  { label: '✕ Reject - Discard and go back', value: 'reject' },
];

export const ApprovalPanel: React.FC<Props> = ({ onSelect }) => {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color="yellow" bold>? </Text>
        <Text bold>What would you like to do?</Text>
      </Box>
      <Box marginTop={1} paddingLeft={2}>
        <SelectInput items={items} onSelect={(item) => onSelect(item.value)} />
      </Box>
      <Box marginTop={1}>
        <Text color="gray" dimColor>Use arrow keys, press Enter to select</Text>
      </Box>
    </Box>
  );
};
