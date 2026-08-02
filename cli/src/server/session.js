import fs from 'node:fs';
import path from 'node:path';

const SESSION_VERSION = 1;

function canonicalPath(value) {
  try {
    return fs.realpathSync(value);
  } catch {
    return path.resolve(value);
  }
}

function belongsToProject(child, projectRoot) {
  if (!child || !projectRoot) return false;
  const relative = path.relative(canonicalPath(projectRoot), canonicalPath(child));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export function sessionPath(projectRoot) {
  return path.join(projectRoot, '.redev', 'session.json');
}

/** Read a project-local selection. Invalid or stale session files are ignored. */
export function loadProjectSession(projectRoot) {
  try {
    const session = JSON.parse(fs.readFileSync(sessionPath(projectRoot), 'utf8'));
    if (session.version !== SESSION_VERSION || !session.app?.framework || !session.app?.fingerprint) return null;
    if (session.projectRoot !== canonicalPath(projectRoot)) return null;
    return session;
  } catch {
    return null;
  }
}

/**
 * Persist a stable app identity, not a port. A port can change after a dev
 * server restart, while the document fingerprint and process project remain
 * useful evidence for a later selection.
 */
export function saveProjectSession(projectRoot, candidate) {
  if (!candidate?.framework || !candidate?.fingerprint) return;
  const destination = sessionPath(projectRoot);
  const session = {
    version: SESSION_VERSION,
    projectRoot: canonicalPath(projectRoot),
    selectedAt: new Date().toISOString(),
    app: {
      framework: candidate.framework,
      fingerprint: candidate.fingerprint,
      processCwd: candidate.process?.cwd ? canonicalPath(candidate.process.cwd) : null,
    },
  };
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(session, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, destination);
}

/**
 * A saved session is only trusted if it points to exactly one currently
 * discovered app. It must never resolve a multi-app ambiguity by itself.
 */
export function findSessionCandidate(session, candidates, projectRoot) {
  if (!session) return null;
  const matchingFingerprint = candidates.filter((candidate) => (
    candidate.framework === session.app.framework &&
    candidate.fingerprint === session.app.fingerprint &&
    candidate.process?.cwd && belongsToProject(candidate.process.cwd, projectRoot)
  ));
  const matchingProject = session.app.processCwd
    ? matchingFingerprint.filter((candidate) => candidate.process?.cwd && canonicalPath(candidate.process.cwd) === session.app.processCwd)
    : matchingFingerprint;
  return matchingProject.length === 1 ? matchingProject[0] : null;
}
