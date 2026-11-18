import express from 'express';
import http from 'node:http';
import cors from 'cors';
import { WebSocketServer } from 'ws';

const PORT = 3001;
const IDLE_TIMEOUT_MS = 15_000;
const DELETE_TIMEOUT_MS = 120_000;
const LEAVING_DELETE_MS = 4_000;

const READ_TOOLS = new Set([
  'read_file',
  'grep_search',
  'view_code_item',
  'find_by_name',
  'view_file',
  'list_dir',
]);

const WRITE_TOOLS = new Set([
  'replace_file_content',
  'write_to_file',
  'run_command',
  'edit_file',
  'write_file',
  'multi_replace_file_content',
]);

const BROWSER_TOOLS = new Set(['browser_subagent', 'web_search', 'search_web']);
const WAITING_TOOLS = new Set(['AskUserQuestion', 'ask_question']);

const AVATAR_COLORS = [
  '#38bdf8',
  '#4ade80',
  '#f472b6',
  '#fb923c',
  '#a78bfa',
  '#facc15',
  '#2dd4bf',
];

const HAIR_COLORS = [
  '#1e293b',
  '#7c2d12',
  '#4c1d95',
  '#b45309',
  '#0f766e',
  '#be185d',
  '#374151',
];

const DEPARTMENT_NAMES = {
  Entering: 'Cổng Vào Tầng 1',
  Leaving: 'Lối Ra Văn Phòng',
  Read: 'Tầng 2 • Phòng Họp & Nghiên Cứu',
  Write: 'Tầng 1 • Khu Lập Trình & Tự Động Hóa',
  Browser: 'Tầng 1 • Đài Quả Địa Cầu Hologram',
  Waiting: 'Tầng 1 • Bàn Điều Phối & Tiếp Đón',
  Idle: 'Tầng 1 • Khu Sofa & Thưởng Trà',
};

const IDLE_QUOTES = [
  'Vừa hoàn thành xong việc! Đang ngồi sofa thưởng thức tách trà nóng nạp năng lượng 🍵',
  'Đã xử lý xong tác vụ được giao, ngồi ghế bành sofa nghỉ ngơi chờ lệnh mới từ sếp! 🛋️',
  'Code chạy mượt rồi! Đang nhâm nhi trà chiều tại khu Lounge Tầng 1 thư giãn ☕',
  'Tạm nghỉ giải lao uống trà sau chuỗi tác vụ liên tục, sẵn sàng chạy tiếp bất cứ lúc nào! ✨',
];

function mapStatus(event, toolName, currentStatus = 'Idle') {
  if (event === 'SubagentStart') return 'Entering';
  if (event === 'SubagentStop') return 'Leaving';
  if (event === 'IdleNow') return 'Idle';

  if (toolName) {
    if (READ_TOOLS.has(toolName)) return 'Read';
    if (WRITE_TOOLS.has(toolName)) return 'Write';
    if (BROWSER_TOOLS.has(toolName)) return 'Browser';
    if (WAITING_TOOLS.has(toolName)) return 'Waiting';
    if (toolName.includes('browser') || toolName.includes('chrome')) return 'Browser';
  }

  if (event === 'PreToolUse' || event === 'PostToolUse') {
    return currentStatus === 'Entering' ? 'Write' : currentStatus;
  }

  return currentStatus;
}

function buildComicReport({ status, event, toolName, detail, stepCount }) {
  const target = detail ? ` "${detail}"` : '';
  const isDoneStep = event === 'PostToolUse';

  if (status === 'Entering') {
    return {
      reportText: 'Em vừa nhận nhiệm vụ mới! Đang quẹt thẻ bước vào văn phòng để bắt đầu làm việc ngay 🏃‍♂️💨',
      progress: 15,
      stageLabel: 'Khởi động nhiệm vụ',
    };
  }

  if (status === 'Leaving') {
    return {
      reportText: `Báo cáo sếp: Đã hoàn tất toàn bộ ${stepCount} bước công việc! Em xin phép check-out rời văn phòng 👋`,
      progress: 100,
      stageLabel: 'Hoàn thành 100%',
    };
  }

  if (status === 'Read') {
    if (toolName === 'grep_search' || toolName === 'find_by_name') {
      return {
        reportText: isDoneStep
          ? `Đã lọc xong kết quả tìm kiếm${target} tại Tầng 2! Đang tổng hợp báo cáo (Bước #${stepCount}) 🔍`
          : `Đang leo cầu thang lên Tầng 2 rà soát tài liệu tìm${target}... Tiến độ bước #${stepCount} đạt 65% 🔎`,
        progress: isDoneStep ? 90 : 65,
        stageLabel: `Tầng 2 • Bước #${stepCount} • Tra cứu`,
      };
    }
    return {
      reportText: isDoneStep
        ? `Đã đọc & phân tích xong file${target} ở Tầng 2! Chuẩn bị xuống xử lý tiếp 📖`
        : `Đang ngồi ở Phòng Họp & Nghiên Cứu Tầng 2 đọc kỹ file${target}... (Bước #${stepCount}) 📚`,
      progress: isDoneStep ? 92 : 60,
      stageLabel: `Tầng 2 • Bước #${stepCount} • Đọc tài liệu`,
    };
  }

  if (status === 'Write') {
    if (toolName === 'run_command') {
      return {
        reportText: isDoneStep
          ? `Lệnh terminal${target} đã chạy xong không lỗi! Hoàn tất bước #${stepCount} ⚡`
          : `Đang ngồi máy trạm Tầng 1 gõ và chạy lệnh${target}... (Bước #${stepCount}) 💻`,
        progress: isDoneStep ? 95 : 70,
        stageLabel: `Tầng 1 • Bước #${stepCount} • Chạy Terminal`,
      };
    }
    return {
      reportText: isDoneStep
        ? `Đã lưu code mới vào file${target}! Kiểm tra cú pháp hoàn tất ✨`
        : `Đang ngồi bàn lập trình Tầng 1 viết & sửa code file${target}... Tới bước #${stepCount} rồi sếp! ✍️`,
      progress: isDoneStep ? 94 : 68,
      stageLabel: `Tầng 1 • Bước #${stepCount} • Viết Code`,
    };
  }

  if (status === 'Browser') {
    return {
      reportText: isDoneStep
        ? `Đã thu thập xong dữ liệu từ Quả Địa Cầu Hologram${target}! (Hoàn thành bước #${stepCount}) 🌐`
        : `Đang đứng trước Quả Địa Cầu AI trung tâm tra cứu web${target}... (Bước #${stepCount}) 🖥️`,
      progress: isDoneStep ? 92 : 62,
      stageLabel: `Trung Tâm • Bước #${stepCount} • Duyệt Web`,
    };
  }

  if (status === 'Waiting') {
    return {
      reportText: `Đang ngồi ở bàn Điều Phối Tầng 1 chờ sếp duyệt${target} để làm tiếp bước #${stepCount} 🙋‍♂️`,
      progress: 50,
      stageLabel: `Tầng 1 • Bước #${stepCount} • Chờ phản hồi`,
    };
  }

  return {
    reportText: IDLE_QUOTES[stepCount % IDLE_QUOTES.length],
    progress: 100,
    stageLabel: `Đã xong ${stepCount} bước • Đang nghỉ ngơi`,
  };
}

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

/** @type {Map<string, any>} */
const agents = new Map();
let colorCounter = 0;

function getAgentList() {
  return Array.from(agents.values());
}

function broadcastAgents() {
  const payload = JSON.stringify({
    type: 'agents_update',
    agents: getAgentList(),
    timestamp: Date.now(),
  });

  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(payload);
    }
  }
}

wss.on('connection', (ws) => {
  ws.send(
    JSON.stringify({
      type: 'agents_update',
      agents: getAgentList(),
      timestamp: Date.now(),
    })
  );
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, agentCount: agents.size });
});

app.get('/agents', (_req, res) => {
  res.json({ agents: getAgentList() });
});

app.post('/hook', (req, res) => {
  const { agentId, agentName, event, toolName, detail, reportText: customReport } = req.body || {};
  if (!agentId) {
    return res.status(400).json({ error: 'agentId is required' });
  }

  const now = Date.now();
  const existing = agents.get(agentId);
  const nextStatus = mapStatus(event, toolName, existing?.status || 'Idle');
  const idx = existing ? existing.paletteIndex : colorCounter++;
  const color = existing?.color || AVATAR_COLORS[idx % AVATAR_COLORS.length];
  const hairColor = existing?.hairColor || HAIR_COLORS[idx % HAIR_COLORS.length];

  const prevStepCount = existing?.stepCount || 0;
  const stepCount =
    event === 'PreToolUse' || event === 'SubagentStart' || !existing
      ? prevStepCount + 1
      : Math.max(1, prevStepCount);

  const built = buildComicReport({
    status: nextStatus,
    event: event || 'Hook',
    toolName: toolName || '',
    detail: detail || '',
    stepCount,
  });

  const updated = {
    agentId,
    agentName: agentName || existing?.agentName || `Agent-${String(agentId).slice(0, 6)}`,
    status: nextStatus,
    department: DEPARTMENT_NAMES[nextStatus] || DEPARTMENT_NAMES.Idle,
    event: event || 'Hook',
    toolName: toolName || '',
    detail: detail || '',
    stepCount,
    progress: built.progress,
    stageLabel: built.stageLabel,
    reportText: customReport || built.reportText,
    color,
    hairColor,
    paletteIndex: idx,
    lastActive: now,
    leavingAt: nextStatus === 'Leaving' ? now : null,
  };

  agents.set(agentId, updated);
  broadcastAgents();

  res.json({ ok: true, agent: updated });
});

// Periodically transition inactive agents to Idle (15s) and remove after 2 minutes (120s)
setInterval(() => {
  const now = Date.now();
  let changed = false;

  for (const [id, agent] of agents.entries()) {
    if (agent.status === 'Leaving' && agent.leavingAt && now - agent.leavingAt >= LEAVING_DELETE_MS) {
      agents.delete(id);
      changed = true;
      continue;
    }

    const inactiveMs = now - agent.lastActive;
    if (inactiveMs >= DELETE_TIMEOUT_MS) {
      agents.delete(id);
      changed = true;
    } else if (
      inactiveMs >= IDLE_TIMEOUT_MS &&
      agent.status !== 'Idle' &&
      agent.status !== 'Leaving'
    ) {
      const doneSteps = agent.stepCount || 1;
      agent.status = 'Idle';
      agent.department = DEPARTMENT_NAMES.Idle;
      agent.toolName = '';
      agent.progress = 100;
      agent.stageLabel = `Đã xong ${doneSteps} bước • Nghỉ giải lao`;
      agent.reportText = IDLE_QUOTES[doneSteps % IDLE_QUOTES.length];
      changed = true;
    }
  }

  if (changed) {
    broadcastAgents();
  }
}, 1000);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(
      `[Antigravity 3D Office] Port ${PORT} is already running in another terminal — reusing existing server.`
    );
  } else {
    console.error('[Antigravity 3D Office] Server error:', err);
  }
});

server.listen(PORT, () => {
  console.log(`[Antigravity 3D Office] Server listening on http://localhost:${PORT}`);
});
