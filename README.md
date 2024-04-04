
This project is a simplified peer-to-peer (P2P) auction solution built on Hyperswarm RPC and Hypercores. It is designed to allow clients to open auctions, make bids, and close auctions, with all actions being propagated to all parties in the ecosystem.

## Implementation Details

The project is implemented in JavaScript and uses Hyperbee, Hyperswarm and Hyperswarm/rpc for the management of the  auctions and P2P network.

### Server Methods

The server provides the following methods:

### `create()`

This method allows a client to create an auction. It requires a JSON object with a  `title`  and  `amount`  as parameters. The  `title`  is the name of the auction and the  `amount`  is the initial bid amount. The method creates a new auction with the provided title and amount, and joins the auction channel.

### `join()`

This method allows a client to join an existing auction. It requires a JSON object with a  `title`  as a parameter. The  `title`  is the name of the auction. The method joins the auction channel with the provided title.

### `leave()`

This method allows a client to leave an auction. It requires a JSON object with a  `title`  as a parameter. The  `title`  is the name of the auction. The method leaves the auction channel with the provided title.

### `auction()`

This method allows a client to make a bid for an auction. It requires a JSON object with a  `title`,  `amount`, and  `client`  as parameters. The  `title`  is the name of the auction, the  `amount`  is the bid amount, and the  `client`  is the identifier of the client making the bid. The method sends a message to all peers in the auction channel with the bid information.

### `settle()`

This method allows a client to settle an auction. It requires a JSON object with a  `title`  as a parameter. The  `title`  is the name of the auction. The method sends a message to all peers in the auction channel with the settlement information.

### Connection Management

The server maintains a list of active connections with clients. When a client makes a bid or settles an auction, the server sends a message to all connected clients to inform them of the action.

### Auction Management

The server uses Hyperbee to manage auctions. Each auction is identified by a topic ID, which is a hash of the auction title. Auction information, such as the highest bid and the client who made the highest bid, is stored in Hyperbee.
