import type { ReactElement } from 'react';

export interface RedevScriptProps {
  /** Port the redev-cli overlay server is running on. Default: 5050. */
  port?: number;
}

/**
 * Injects the Redev overlay script in development only. Drop into your root
 * layout (`app/layout.tsx`). Renders nothing in production.
 */
export function RedevScript(props?: RedevScriptProps): ReactElement | null;
