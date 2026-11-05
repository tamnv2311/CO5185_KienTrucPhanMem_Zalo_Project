import { FormEvent, useEffect, useState } from "react";
import { api } from "../../api/client";

interface Profile {
  id: string;
  email: string;
  displayName: string;
  avatar?: string;
}

export function ProfilePage() {
  const [profile, setProfile] = useState<Profile>();
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    api<Profile>("/users/me").then(value => {
      setProfile(value);
      setDisplayName(value.displayName);
    });
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    const updated = await api<Profile>("/users/me", {
      method: "PUT",
      body: JSON.stringify({ displayName }),
    });
    setProfile(updated);
  }

  return (
    <main>
      <h1>Profile</h1>
      <p>{profile?.email}</p>
      <form onSubmit={save}>
        <input value={displayName} onChange={event => setDisplayName(event.target.value)} />
        <button type="submit">Lưu</button>
      </form>
    </main>
  );
}
