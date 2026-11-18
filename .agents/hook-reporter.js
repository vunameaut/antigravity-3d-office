import http from 'node:http';
import path from 'node:path';

function readStdin(timeoutMs = 350) {
  return new Promise((resolve) => {
    let data = '';
    const timer = setTimeout(() => resolve(data), timeoutMs);

    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      clearTimeout(timer);
      resolve(data);
    });
    process.stdin.on('error', () => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

function extractTargetDetail(toolName, args = {}) {
  if (!args || typeof args !== 'object') return '';
  const filePath =
    args.Path || args.TargetFile || args.FilePath || args.file_path || args.path || '';
  if (filePath) {
    return path.basename(String(filePath));
  }
  if (args.toolSummary) return String(args.toolSummary);
  if (args.CommandLine) return String(args.CommandLine).slice(0, 38);
  if (args.Query || args.query) return String(args.Query || args.query).slice(0, 38);
  if (args.Pattern || args.pattern) return String(args.Pattern || args.pattern).slice(0, 30);
  if (args.Role) return String(args.Role);
  return '';
}

function postHook(payload) {
  return new Promise((resolve) => {
    const body = JSON.stringify(payload);
    const req = http.request(
      {
        hostname: 'localhost',
        port: 3001,
        path: '/hook',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 350,
      },
      (res) => {
        res.resume();
        res.on('end', resolve);
      }
    );

    req.on('timeout', () => {
      req.destroy();
      resolve();
    });
    req.on('error', () => resolve());
    req.write(body);
    req.end();
  });
}

async function main() {
  const raw = await readStdin();
  let input = {};
  try {
    if (raw.trim()) {
      input = JSON.parse(raw);
    }
  } catch {
    input = {};
  }

  const event = input.hookEventName || input.event || process.argv[2] || 'Unknown';
  const toolName = input.toolCall?.name || input.toolName || '';
  const toolArgs = input.toolCall?.args || input.toolArgs || {};
  const detail = input.detail || extractTargetDetail(toolName, toolArgs);
  const stepIdx = input.stepIdx || null;
  const agentId = input.subagentId || input.conversationId || input.agentId || 'main-agent';

  const workspacePath =
    (Array.isArray(input.workspacePaths) && input.workspacePaths[0]) || input.cwd || '';
  const projectLabel = workspacePath ? path.basename(workspacePath) : '';

  const baseName =
    input.subagentRole ||
    input.agentName ||
    (agentId === 'main-agent' ? 'Main Agent' : `Agent-${String(agentId).slice(0, 6)}`);

  const agentName = projectLabel ? `${baseName} [${projectLabel}]` : baseName;

  await postHook({
    agentId,
    agentName,
    event,
    toolName,
    detail,
    stepIdx,
  });

  if (event === 'PreToolUse') {
    process.stdout.write(JSON.stringify({ decision: 'allow' }));
  } else {
    process.stdout.write(JSON.stringify({}));
  }
  process.exit(0);
}

main().catch(() => {
  process.stdout.write(JSON.stringify({}));
  process.exit(0);
});
