import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import net from "node:net";

rmSync(new URL("../.vinext/dev/lock.json", import.meta.url), { force: true });

const listenPort = Number(process.env.MHADA_PROXY_PORT || 8080);
const targetPort = Number(process.env.MHADA_APP_PORT || 5173);

const proxy = net.createServer((client) => {
  const upstream = net.connect({ host: "127.0.0.1", port: targetPort });
  const closeBoth = () => {
    client.destroy();
    upstream.destroy();
  };
  client.on("error", closeBoth);
  upstream.on("error", closeBoth);
  upstream.on("connect", () => {
    client.pipe(upstream);
    upstream.pipe(client);
  });
  client.on("end", () => upstream.end());
  upstream.on("end", () => client.end());
});

proxy.listen(listenPort, "0.0.0.0", () => {
  console.log(
    `MHADA proxy listening on 0.0.0.0:${listenPort} -> 127.0.0.1:${targetPort}`,
  );
});

const child = spawn(
  "pnpm",
  ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(targetPort)],
  { stdio: "inherit", env: process.env },
);

const shutdown = (signal) => {
  child.kill(signal);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

child.on("exit", (code, signal) => {
  proxy.close();
  if (signal) process.exit(1);
  process.exit(code ?? 1);
});
