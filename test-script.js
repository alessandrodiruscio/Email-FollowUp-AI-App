async function run() {
  try {
    console.log("Checking standard route:");
    const res1 = await fetch("http://localhost:3000/api/dashboard/webhook-debug", { method: 'GET' });
    console.log("Status:", res1.status);
    console.log("Text:", await res1.text());

    console.log("Checking explicit ping route:");
    const res2 = await fetch("http://localhost:3000/api/ping", { method: 'GET' });
    console.log("Status:", res2.status);
    console.log("Text:", await res2.text());

  } catch (e) {
    console.error("Error:", e);
  }
}
run();
