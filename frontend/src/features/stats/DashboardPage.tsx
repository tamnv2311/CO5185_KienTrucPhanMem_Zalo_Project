import React, { useEffect, useState } from "react";
import {
  fetchMediaStats,
  fetchStatsOverview,
  fetchTopGroups,
  GroupActivity,
  MediaStats,
  StatsOverview,
} from "../../api/statsApi";

export function DashboardPage() {
  const [overview, setOverview] = useState<StatsOverview>();
  const [groups, setGroups] = useState<GroupActivity[]>([]);
  const [media, setMedia] = useState<MediaStats[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([fetchStatsOverview(), fetchTopGroups(), fetchMediaStats()])
      .then(([summary, topGroups, mediaStats]) => {
        setOverview(summary);
        setGroups(topGroups);
        setMedia(mediaStats);
      })
      .catch(reason => setError(String(reason)));
  }, []);

  return (
    <main style={{ padding: 24 }}>
      <h1>Dashboard thống kê</h1>
      {error && <p role="alert">{error}</p>}
      <section aria-label="Tổng quan" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <Metric label="Tin nhắn" value={overview?.totalMessages ?? 0} />
        <Metric label="Người hoạt động" value={overview?.activeUsers ?? 0} />
        <Metric label="Người dùng mới" value={overview?.newUsers ?? 0} />
        <Metric label="Media" value={overview?.totalMedia ?? 0} />
      </section>
      <section>
        <h2>Nhóm sôi động nhất</h2>
        <table>
          <thead><tr><th>Nhóm</th><th>Số tin nhắn</th></tr></thead>
          <tbody>{groups.map(group => <tr key={group.groupId}>
            <td>{group.groupId}</td><td>{group.messageCount}</td>
          </tr>)}</tbody>
        </table>
      </section>
      <section>
        <h2>Tỷ lệ loại media</h2>
        <ul>{media.map(item => <li key={item.mediaKind}>{item.mediaKind}: {item.count}</li>)}</ul>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <article style={{ border: "1px solid #ddd", padding: 16, borderRadius: 8 }}>
    <strong>{label}</strong><div>{value}</div>
  </article>;
}
