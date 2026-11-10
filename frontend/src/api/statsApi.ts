export interface StatsOverview {
  date: string;
  totalMessages: number;
  activeUsers: number;
  newUsers: number;
  totalMedia: number;
}

export interface GroupActivity {
  groupId: string;
  messageCount: number;
}

export interface MediaStats {
  mediaKind: string;
  count: number;
}

export async function fetchStatsOverview(): Promise<StatsOverview> {
  const response = await fetch("/api/stats/overview");
  if (!response.ok) throw new Error("Không thể tải thống kê tổng quan");
  return response.json();
}

export async function fetchTopGroups(): Promise<GroupActivity[]> {
  const response = await fetch("/api/stats/groups");
  if (!response.ok) throw new Error("Không thể tải thống kê nhóm");
  return response.json();
}

export async function fetchMediaStats(): Promise<MediaStats[]> {
  const response = await fetch("/api/stats/media");
  if (!response.ok) throw new Error("Không thể tải thống kê media");
  return response.json();
}
