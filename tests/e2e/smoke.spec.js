const baseUrl = process.env.ZALOLITE_E2E_URL || "http://localhost";

async function request(path, options = {}) {
  const response = await fetch(baseUrl + path, options);
  if (!response.ok) throw new Error(`${options.method || "GET"} ${path}: ${response.status}`);
  return response;
}

async function run() {
  await request("/actuator/health");
  await request("/api/stats/overview");
  await request("/api/stats/groups");
  await request("/api/stats/media");
  console.log("Zalo-lite E2E smoke passed");
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
