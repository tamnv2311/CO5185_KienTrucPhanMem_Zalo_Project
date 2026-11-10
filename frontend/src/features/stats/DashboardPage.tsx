import { useEffect, useState } from "react";
import { store, useApp } from "../../data/store";
import type { StatsSnapshot } from "../../data/types";
import { Icon } from "../../lib/icons";
import { Avatar } from "../../components/ui";

export function DashboardPage() {
  const [stats, setStats] = useState<StatsSnapshot>();
  const [showTable, setShowTable] = useState(false);
  const messages = useApp(s => s.db.messages);
  const users = useApp(s => s.db.users);

  useEffect(() => {
    let alive = true;
    void store.stats().then(s => { if (alive) setStats(s); });
    return () => { alive = false; };
  }, [messages]);

  if (!stats) return <div className="stats-page"><p className="muted-text pad">Đang tải thống kê…</p></div>;
  const mediaTotal = stats.media.reduce((n, m) => n + m.count, 0) || 1;
  const maxGroup = Math.max(1, ...stats.topGroups.map(g => g.messages));

  return (
    <div className="stats-page">
      <header className="stats-header">
        <div>
          <h1>Thống kê hoạt động</h1>
          <p className="muted-text">7 ngày gần nhất · Nguồn: {stats.source === "api" ? "statistics-service (API)" : "dữ liệu cục bộ trên trình duyệt"}</p>
        </div>
        <button className="btn soft" onClick={() => setShowTable(v => !v)}><Icon name="filter" size={16} /> {showTable ? "Xem biểu đồ" : "Xem dạng bảng"}</button>
      </header>

      <section className="kpi-row">
        <Kpi label="Tổng tin nhắn" value={stats.totalMessages} icon="chat" />
        <Kpi label="Người dùng hoạt động (7 ngày)" value={stats.activeUsers} icon="users" />
        <Kpi label="Người dùng mới" value={stats.newUsers} icon="userPlus" />
        <Kpi label="Ảnh / video / tệp đã gửi" value={stats.totalMedia} icon="image" />
      </section>

      <section className="stats-grid">
        <article className="card chart-card wide">
          <h3>Tin nhắn mỗi ngày</h3>
          {showTable ? <DailyTable stats={stats} /> : <DailyBars data={stats.daily} />}
        </article>

        <article className="card chart-card">
          <h3>Tỷ lệ loại nội dung</h3>
          <div className="hbar-list">
            {stats.media.map(m => (
              <div key={m.kind} className="hbar" title={`${m.kind}: ${m.count}`}>
                <span className="hbar-label">{m.kind}</span>
                <span className="hbar-track"><i style={{ width: `${(m.count / mediaTotal) * 100}%` }} /></span>
                <span className="hbar-value">{m.count} <small>({Math.round((m.count / mediaTotal) * 100)}%)</small></span>
              </div>
            ))}
          </div>
        </article>

        <article className="card chart-card">
          <h3>Nhóm sôi động nhất</h3>
          {stats.topGroups.length === 0 && <p className="muted-text">Chưa có dữ liệu nhóm</p>}
          <div className="hbar-list">
            {stats.topGroups.map(g => (
              <div key={g.id} className="hbar" title={`${g.name}: ${g.messages} tin nhắn`}>
                <span className="hbar-label" title={g.name}>{g.name}</span>
                <span className="hbar-track"><i style={{ width: `${(g.messages / maxGroup) * 100}%` }} /></span>
                <span className="hbar-value">{g.messages}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="card chart-card">
          <h3>Người dùng tích cực</h3>
          <ol className="rank-list">
            {stats.topUsers.map((u, i) => (
              <li key={u.id}><span className="rank">{i + 1}</span><Avatar user={users[u.id] ?? { name: u.name, color: "#888", online: false }} size={32} /><span className="rank-name">{u.name}</span><b>{u.messages}</b></li>
            ))}
          </ol>
        </article>
      </section>
    </div>
  );
}

function Kpi({ label, value, icon }: { label: string; value: number; icon: Parameters<typeof Icon>[0]["name"] }) {
  return (
    <article className="card kpi">
      <span className="kpi-icon"><Icon name={icon} size={20} /></span>
      <div><small>{label}</small><strong>{value.toLocaleString("vi-VN")}</strong></div>
    </article>
  );
}

function DailyBars({ data }: { data: StatsSnapshot["daily"] }) {
  const [hover, setHover] = useState<number>();
  const W = 640, H = 220, pad = { l: 34, r: 8, t: 12, b: 26 };
  const max = Math.max(4, ...data.map(d => d.messages));
  const niceMax = Math.ceil(max / 4) * 4;
  const step = (W - pad.l - pad.r) / data.length;
  const bw = Math.min(36, step * 0.55);
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / niceMax);
  return (
    <div className="bar-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Biểu đồ số tin nhắn theo ngày">
        {[0, 0.25, 0.5, 0.75, 1].map(f => (
          <g key={f}>
            <line x1={pad.l} x2={W - pad.r} y1={y(niceMax * f)} y2={y(niceMax * f)} className="grid" />
            <text x={pad.l - 6} y={y(niceMax * f) + 4} className="axis" textAnchor="end">{Math.round(niceMax * f)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.l + step * i + (step - bw) / 2;
          const top = y(d.messages);
          const h = Math.max(0, H - pad.b - top);
          return (
            <g key={d.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(undefined)}>
              <rect x={pad.l + step * i} y={pad.t} width={step} height={H - pad.t - pad.b} fill="transparent" />
              {h > 0 && <path className={`bar ${hover === i ? "hover" : ""}`} d={`M${x},${H - pad.b} V${top + Math.min(4, h)} Q${x},${top} ${x + 4},${top} H${x + bw - 4} Q${x + bw},${top} ${x + bw},${top + Math.min(4, h)} V${H - pad.b} Z`} />}
              <text x={x + bw / 2} y={H - 8} className="axis" textAnchor="middle">{d.date}</text>
            </g>
          );
        })}
      </svg>
      {hover !== undefined && (
        <div className="chart-tip" style={{ left: `${((pad.l + step * hover + step / 2) / W) * 100}%` }}>
          <b>{data[hover].date}</b>
          <span>{data[hover].messages} tin nhắn</span>
          <span>{data[hover].activeUsers} người gửi</span>
        </div>
      )}
    </div>
  );
}

function DailyTable({ stats }: { stats: StatsSnapshot }) {
  return (
    <table className="data-table">
      <thead><tr><th>Ngày</th><th>Tin nhắn</th><th>Người gửi</th></tr></thead>
      <tbody>{stats.daily.map(d => <tr key={d.date}><td>{d.date}</td><td>{d.messages}</td><td>{d.activeUsers}</td></tr>)}</tbody>
    </table>
  );
}
