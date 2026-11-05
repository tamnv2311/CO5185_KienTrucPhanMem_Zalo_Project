import { FormEvent, useEffect, useState } from "react";
import { api } from "../../api/client";

interface Group {
  id: string;
  name: string;
}

export function GroupPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [name, setName] = useState("");

  function load() {
    api<Group[]>("/groups").then(setGroups);
  }

  useEffect(load, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    await api<Group>("/groups", {
      method: "POST",
      body: JSON.stringify({ name, memberIds: [] }),
    });
    setName("");
    load();
  }

  return (
    <main>
      <h1>Nhóm</h1>
      <form onSubmit={create}>
        <input aria-label="Tên nhóm" value={name} onChange={event => setName(event.target.value)} required />
        <button type="submit">Tạo nhóm</button>
      </form>
      <ul>{groups.map(group => <li key={group.id}>{group.name}</li>)}</ul>
    </main>
  );
}
