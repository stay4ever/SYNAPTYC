/**
 * Integration test: verifies auth, messaging, key_exchange relay, and mark_read.
 * Run with: node test-integration.js
 */

const http = require("http");
const WebSocket = require("ws");

const BASE = "http://localhost:3000";
let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}`);
    failed++;
  }
}

async function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: { "Content-Type": "application/json" },
    };
    if (token) options.headers["Authorization"] = `Bearer ${token}`;

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function connectWS(token) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://localhost:3000/chat?token=${token}`);
    ws.on("open", () => resolve(ws));
    ws.on("error", (err) => {
      console.error("WS error:", err.message);
      resolve(null);
    });
  });
}

function waitForMessage(ws, type, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    const handler = (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === type) {
        clearTimeout(timer);
        ws.removeListener("message", handler);
        resolve(msg);
      }
    };
    ws.on("message", handler);
  });
}

async function run() {
  console.log("\n🔬 nano-SYNAPSYS Backend Integration Tests\n");

  // 1. Register two users
  console.log("--- Auth ---");
  const r1 = await request("POST", "/auth/register", {
    username: "alice_test",
    email: "alice@test.com",
    password: "password123",
    display_name: "Alice",
  });
  assert(r1.status === 201, `Register Alice: status ${r1.status}`);
  const aliceToken = r1.body.token;
  const aliceId = r1.body.user?.id;

  const r2 = await request("POST", "/auth/register", {
    username: "bob_test",
    email: "bob@test.com",
    password: "password456",
    display_name: "Bob",
  });
  assert(r2.status === 201, `Register Bob: status ${r2.status}`);
  const bobToken = r2.body.token;
  const bobId = r2.body.user?.id;

  // 2. Login
  const r3 = await request("POST", "/auth/login", {
    email: "alice@test.com",
    password: "password123",
  });
  assert(r3.status === 200 && r3.body.token, `Login Alice: got token`);

  // 3. Get /auth/me
  const r4 = await request("GET", "/auth/me", null, aliceToken);
  assert(r4.status === 200 && r4.body.user.username === "alice_test", `GET /auth/me works`);

  // 4. List users
  console.log("\n--- Users ---");
  const r5 = await request("GET", "/api/users", null, aliceToken);
  assert(r5.status === 200 && r5.body.users.length >= 2, `GET /api/users: ${r5.body.users.length} users`);

  // 5. Send encrypted message via REST
  console.log("\n--- Messages ---");
  const r6 = await request(
    "POST",
    "/api/messages",
    { to_user: bobId, content: "ENC:dGVzdA==" },
    aliceToken
  );
  assert(r6.status === 201 && r6.body.message.content === "ENC:dGVzdA==", `Send encrypted DM`);

  // 6. Send KEX message via REST
  const r7 = await request(
    "POST",
    "/api/messages",
    { to_user: bobId, content: "KEX:AAAA1234base64pubkey==" },
    aliceToken
  );
  assert(r7.status === 201 && r7.body.message.content.startsWith("KEX:"), `Send KEX message via REST`);

  // 7. Get messages
  const r8 = await request("GET", `/api/messages/${bobId}`, null, aliceToken);
  assert(r8.status === 200 && r8.body.messages.length === 2, `GET messages: ${r8.body.messages.length} msgs`);

  // 8. Contacts
  console.log("\n--- Contacts ---");
  const r9 = await request("POST", "/api/contacts", { receiver_id: bobId }, aliceToken);
  assert(r9.status === 201 && r9.body.contact.status === "pending", `Send contact request`);

  const r10 = await request("PATCH", `/api/contacts/${r9.body.contact.id}`, { status: "accepted" }, bobToken);
  assert(r10.status === 200 && r10.body.contact.status === "accepted", `Accept contact request`);

  // 9. Groups
  console.log("\n--- Groups ---");
  const r11 = await request("POST", "/api/groups", { name: "Test Group", description: "E2E group" }, aliceToken);
  assert(r11.status === 201 && r11.body.name === "Test Group", `Create group`);
  const groupId = r11.body.id;

  const r12 = await request("POST", `/api/groups/${groupId}/members`, { user_id: bobId }, aliceToken);
  assert(r12.status === 200 && r12.body.members.length === 2, `Add Bob to group: ${r12.body.members.length} members`);

  // 10. WebSocket tests
  console.log("\n--- WebSocket ---");
  const aliceWs = await connectWS(aliceToken);
  const bobWs = await connectWS(bobToken);
  assert(aliceWs !== null, `Alice WebSocket connected`);
  assert(bobWs !== null, `Bob WebSocket connected`);

  if (aliceWs && bobWs) {
    // Wait for user_list broadcast
    const userListPromise = waitForMessage(aliceWs, "user_list");
    const userList = await userListPromise;
    assert(userList !== null, `Received user_list broadcast`);

    // 11. Key exchange relay
    const kexPromise = waitForMessage(bobWs, "key_exchange");
    aliceWs.send(
      JSON.stringify({
        type: "key_exchange",
        to: bobId,
        public_key: "AAAA_fake_ecdh_pubkey_base64==",
      })
    );
    const kex = await kexPromise;
    assert(
      kex !== null && kex.from === aliceId && kex.public_key === "AAAA_fake_ecdh_pubkey_base64==",
      `key_exchange relayed to Bob with correct from=${kex?.from} and public_key`
    );

    // 12. Chat message via WS
    const chatPromise = waitForMessage(bobWs, "chat_message");
    aliceWs.send(
      JSON.stringify({ type: "chat_message", to: bobId, content: "ENC:encrypted_ws_msg" })
    );
    const chat = await chatPromise;
    assert(
      chat !== null && chat.from === aliceId && chat.content === "ENC:encrypted_ws_msg",
      `chat_message relayed via WS`
    );

    // 13. Typing relay
    const typingPromise = waitForMessage(bobWs, "typing");
    aliceWs.send(JSON.stringify({ type: "typing", to: bobId }));
    const typing = await typingPromise;
    assert(typing !== null && typing.from === aliceId, `typing relayed`);

    // 14. Mark read relay
    if (chat) {
      const markPromise = waitForMessage(aliceWs, "mark_read");
      bobWs.send(JSON.stringify({ type: "mark_read", message_id: chat.id }));
      const markRead = await markPromise;
      assert(markRead !== null && markRead.message_id === chat.id, `mark_read relayed back to sender`);
    }

    // 15. Group message via WS
    const groupMsgPromise = waitForMessage(bobWs, "group_message");
    aliceWs.send(
      JSON.stringify({ type: "group_message", group_id: groupId, content: "ENC:group_encrypted" })
    );
    const groupMsg = await groupMsgPromise;
    assert(
      groupMsg !== null && groupMsg.content === "ENC:group_encrypted" && groupMsg.group_id === groupId,
      `group_message relayed to Bob`
    );

    aliceWs.close();
    bobWs.close();
  }

  // Summary
  console.log(`\n${"=".repeat(50)}`);
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log(`${"=".repeat(50)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
