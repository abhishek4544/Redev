import React from 'react';
import { Box, Text } from 'ink';
import type { SelectedElement } from '../types/index.js';

interface Props {
  element: SelectedElement;
}

export const ElementInfo: React.FC<Props> = ({ element }) => {
  const confidenceColor =
    element.confidence >= 0.9 ? 'green' :
    element.confidence >= 0.7 ? 'yellow' : 'red';

  const confidenceLabel =
    element.confidence >= 0.9 ? 'High' :
    element.confidence >= 0.7 ? 'Medium' : 'Low';

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="green" padding={1}>
      <Box>
        <Text color="green" bold>✓ Element selected</Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Box>
          <Text color="gray">Component: </Text>
          <Text color="cyan" bold>{element.component}</Text>
          <Text color="gray"> ({element.tagName})</Text>
        </Box>

        <Box>
          <Text color="gray">File:      </Text>
          <Text color="white">{element.file}</Text>
          <Text color="gray">:</Text>
          <Text color="yellow">{element.line}</Text>
        </Box>

        <Box>
          <Text color="gray">Confidence: </Text>
          <Text color={confidenceColor} bold>
            {confidenceLabel} ({(element.confidence * 100).toFixed(0)}%)
          </Text>
        </Box>

        {element.classes.length > 0 && (
          <Box marginTop={1} flexDirection="column">
            <Text color="gray">Classes:</Text>
            <Box paddingLeft={2}>
              <Text color="magenta">{element.classes.join(' ')}</Text>
            </Box>
          </Box>
        )}

        {Object.keys(element.props).length > 0 && (
          <Box marginTop={1} flexDirection="column">
            <Text color="gray">Props:</Text>
            {Object.entries(element.props).map(([key, value]) => (
              <Box key={key} paddingLeft={2}>
                <Text color="blue">{key}</Text>
                <Text color="gray">=</Text>
                <Text color="white">"{value}"</Text>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
};
