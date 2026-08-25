import { QuantMcpServer } from "./server.js";

function main() {
  const server = new QuantMcpServer();
  server.startStdio();
}

main();
