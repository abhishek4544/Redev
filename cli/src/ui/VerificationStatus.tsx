import React from 'react';
import { Box, Text } from 'ink';
import type { VerificationResult } from '../types/index.js';

interface Props {
  results: VerificationResult[];
}

export const VerificationStatus: React.FC<Props> = ({ results }) => {
  const allVerified = results.every(r => r.status === 'verified');

  return (
    <Box flexDirection="column" marginTop={1} borderStyle="round" borderColor={allVerified ? 'green' : 'yellow'} padding={1}>
      <Box marginBottom={1}>
        <Text bold color={allVerified ? 'green' : 'yellow'}>
          {allVerified ? '✅ Verified' : '⚠️  Needs Review'}
        </Text>
      </Box>

      {results.map((result, i) => {
        const icon =
          result.status === 'verified' ? '✓' :
          result.status === 'needs-review' ? '⚠' : '✕';
        const color =
          result.status === 'verified' ? 'green' :
          result.status === 'needs-review' ? 'yellow' : 'red';
        const viewportLabel =
          result.viewport === 'desktop' ? 'Desktop (1440px)' :
          result.viewport === 'tablet' ? 'Tablet (768px)  ' : 'Mobile (375px)  ';

        return (
          <Box key={i} flexDirection="column">
            <Box>
              <Text color={color}>{icon} </Text>
              <Text color="gray">{viewportLabel}: </Text>
              <Text color={color} bold>
                {result.status === 'verified' ? 'Verified' :
                 result.status === 'needs-review' ? 'Needs Review' : 'Failed'}
              </Text>
            </Box>
            {result.message && (
              <Box paddingLeft={4}>
                <Text color="gray" dimColor>{result.message}</Text>
              </Box>
            )}
            {result.requestedValue && result.actualValue && (
              <Box paddingLeft={4} flexDirection="column">
                <Text color="gray">requested: <Text color="cyan">{result.requestedValue}</Text></Text>
                <Text color="gray">actual:    <Text color="cyan">{result.actualValue}</Text></Text>
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
};
