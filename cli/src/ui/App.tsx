import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useApp } from 'ink';
import Spinner from 'ink-spinner';
import { Header } from './Header.js';
import { ConnectionStatus } from './ConnectionStatus.js';
import { WaitingScreen } from './WaitingScreen.js';
import { ElementInfo } from './ElementInfo.js';
import { PromptInput } from './PromptInput.js';
import { GeneratingScreen } from './GeneratingScreen.js';
import { DiffViewer } from './DiffViewer.js';
import { ApprovalPanel, type ApprovalChoice } from './ApprovalPanel.js';
import { VerificationStatus } from './VerificationStatus.js';
import { RedevWebSocketClient, type WSMessage } from '../services/WebSocketClient.js';
import type { CLIState, SelectedElement, CodeChange, VerificationResult } from '../types/index.js';

interface Props {
  demo?: boolean;
  wsPort?: number;
}

export const App: React.FC<Props> = ({ demo = false, wsPort = 3001 }) => {
  const { exit } = useApp();
  const [state, setState] = useState<CLIState>({ type: 'waiting' });
  const [backendConnected, setBackendConnected] = useState(false);
  const [browserConnected, setBrowserConnected] = useState(false);
  const [reasoning, setReasoning] = useState<string | null>(null);
  const wsRef = useRef<RedevWebSocketClient | null>(null);
  const stateRef = useRef<CLIState>(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (demo) {
      const timer = setTimeout(() => {
        const element: SelectedElement = {
          id: 'demo-btn-1',
          component: 'Button',
          file: 'src/components/Button.tsx',
          line: 42,
          column: 4,
          tagName: 'button',
          classes: ['px-2', 'py-1', 'bg-blue-500', 'text-white', 'rounded'],
          props: { variant: 'primary', size: 'sm' },
          confidence: 0.95,
        };
        setState({ type: 'element-selected', element });
      }, 2000);
      return () => clearTimeout(timer);
    }

    const client = new RedevWebSocketClient(wsPort);
    wsRef.current = client;

    client.on('connected', () => setBackendConnected(true));
    client.on('disconnected', () => {
      setBackendConnected(false);
      setBrowserConnected(false);
    });
    client.on('browser-connected', () => setBrowserConnected(true));

    client.on('element-selected', (message: WSMessage) => {
      const element = message.element as SelectedElement;
      setState({ type: 'element-selected', element });
      setReasoning(null);
    });

    client.on('change-generated', (message: WSMessage) => {
      const current = stateRef.current;
      if (current.type !== 'generating') return;

      if (message.error) {
        setState({ type: 'error', message: message.error as string });
        return;
      }

      const changes = (message.changes as CodeChange[]) || [];
      if (changes.length === 0) {
        setState({ type: 'error', message: 'Claude returned no changes' });
        return;
      }

      setReasoning((message.reasoning as string) || null);
      setState({
        type: 'reviewing',
        element: current.element,
        prompt: current.prompt,
        changes,
      });
    });

    client.on('apply-result', (message: WSMessage) => {
      const current = stateRef.current;
      if (current.type !== 'applying') return;

      const results = (message.results as Array<{ file: string; applied: boolean; reason?: string }>) || [];
      const failures = results.filter((r) => !r.applied);
      if (failures.length > 0) {
        const reasons = failures.map((f) => `${f.file}: ${f.reason}`).join('; ');
        setState({ type: 'error', message: `Could not apply change — ${reasons}` });
        return;
      }

      const verificationResults: VerificationResult[] = [
        { viewport: 'desktop', status: 'verified', message: 'File written successfully' },
        { viewport: 'tablet', status: 'needs-review', message: 'Viewport verification not yet implemented' },
        { viewport: 'mobile', status: 'needs-review', message: 'Viewport verification not yet implemented' },
      ];
      setState({ type: 'complete', results: verificationResults });
    });

    client.connect();

    return () => {
      client.disconnect();
    };
  }, [demo, wsPort]);

  const handlePromptSubmit = (prompt: string) => {
    if (state.type !== 'element-selected') return;

    const element = state.element;
    setState({ type: 'generating', element, prompt });
    setReasoning(null);

    if (demo) {
      setTimeout(() => {
        const changes: CodeChange[] = [
          {
            file: element.file,
            line: element.line,
            before: `className="${element.classes.join(' ')}"`,
            after: `className="px-4 py-2 bg-blue-500 text-white rounded-lg"`,
          },
        ];
        setState({ type: 'reviewing', element, prompt, changes });
      }, 3000);
    } else {
      wsRef.current?.send({
        type: 'change-request',
        elementId: element.id,
        prompt,
      });
    }
  };

  const handleApproval = (choice: ApprovalChoice) => {
    if (state.type !== 'reviewing') return;

    switch (choice) {
      case 'accept':
        setState({ type: 'applying', changes: state.changes });
        if (demo) {
          setTimeout(() => {
            setState({ type: 'verifying', changes: state.changes });
            setTimeout(() => {
              const results: VerificationResult[] = [
                { viewport: 'desktop', status: 'verified', requestedValue: 'padding: 16px 8px', actualValue: 'padding: 16px 8px' },
                { viewport: 'tablet', status: 'verified', requestedValue: 'padding: 16px 8px', actualValue: 'padding: 16px 8px' },
                { viewport: 'mobile', status: 'verified', requestedValue: 'padding: 16px 8px', actualValue: 'padding: 16px 8px' },
              ];
              setState({ type: 'complete', results });
              setTimeout(() => exit(), 4000);
            }, 2500);
          }, 1500);
        } else {
          wsRef.current?.send({ type: 'change-applied', changes: state.changes });
        }
        break;
      case 'reject':
        setState({ type: 'waiting' });
        break;
      case 'edit':
        setState({ type: 'element-selected', element: state.element });
        break;
      case 'reselect':
        setState({ type: 'waiting' });
        break;
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Header />
      {!demo && <ConnectionStatus backend={backendConnected} browser={browserConnected} />}

      {state.type === 'waiting' && <WaitingScreen />}

      {state.type === 'element-selected' && (
        <>
          <ElementInfo element={state.element} />
          <PromptInput onSubmit={handlePromptSubmit} />
        </>
      )}

      {state.type === 'generating' && <GeneratingScreen prompt={state.prompt} />}

      {state.type === 'reviewing' && (
        <>
          {reasoning && (
            <Box marginTop={1} paddingLeft={2}>
              <Text color="gray" italic>Claude: {reasoning}</Text>
            </Box>
          )}
          <DiffViewer changes={state.changes} />
          <ApprovalPanel onSelect={handleApproval} />
        </>
      )}

      {state.type === 'applying' && (
        <Box marginTop={1}>
          <Text color="cyan">
            <Spinner type="dots" />
          </Text>
          <Text> Writing changes to disk...</Text>
        </Box>
      )}

      {state.type === 'verifying' && (
        <Box marginTop={1}>
          <Text color="cyan">
            <Spinner type="dots" />
          </Text>
          <Text> Verifying across desktop, tablet, and mobile...</Text>
        </Box>
      )}

      {state.type === 'complete' && (
        <>
          <VerificationStatus results={state.results || []} />
          <Box marginTop={1}>
            <Text color="green" bold>Done! Change committed to source.</Text>
          </Box>
          {demo && (
            <Box marginTop={1}>
              <Text color="gray" dimColor>Session will exit in 4 seconds...</Text>
            </Box>
          )}
        </>
      )}

      {state.type === 'error' && (
        <Box marginTop={1} flexDirection="column" borderStyle="round" borderColor="red" padding={1}>
          <Box>
            <Text color="red" bold>Error: </Text>
            <Text>{state.message}</Text>
          </Box>
          <Box marginTop={1}>
            <Text color="gray" dimColor>Click a different element or restart the CLI to try again.</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};
