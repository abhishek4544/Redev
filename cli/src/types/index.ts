export interface SelectedElement {
  id: string;
  component: string;
  file: string;
  line: number;
  column: number;
  tagName: string;
  classes: string[];
  props: Record<string, string>;
  confidence: number;
  componentScopeAvailable?: boolean;
  editScope?: 'component' | 'instance';
}

export interface CodeChange {
  file: string;
  line: number;
  before: string;
  after: string;
}

export interface VerificationResult {
  viewport: 'desktop' | 'tablet' | 'mobile';
  status: 'verified' | 'needs-review' | 'failed';
  requestedValue?: string;
  actualValue?: string;
  message?: string;
}

export interface AgentInstructions {
  requestId: string;
  pendingPath: string;
  promptForAgent: string;
}

export type CLIState =
  | { type: 'waiting' }
  | { type: 'element-selected'; element: SelectedElement }
  | { type: 'prompting'; element: SelectedElement }
  | { type: 'generating'; element: SelectedElement; prompt: string }
  | { type: 'awaiting-agent'; element: SelectedElement; prompt: string; instructions: AgentInstructions }
  | { type: 'reviewing'; element: SelectedElement; prompt: string; changes: CodeChange[] }
  | { type: 'applying'; changes: CodeChange[] }
  | { type: 'verifying'; changes: CodeChange[] }
  | { type: 'complete'; summary?: string; filesEdited?: string[]; results?: VerificationResult[] }
  | { type: 'error'; message: string };
