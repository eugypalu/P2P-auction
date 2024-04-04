import Server from './server.js';
import Client from './client.js';

(async () => {
  let server = new Server();
  const serverPub = await server.start();

  let client = new Client(serverPub);
  await client.connect();
})();