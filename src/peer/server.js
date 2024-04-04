'use strict'

import RPC from '@hyperswarm/rpc';
import Hyperswarm from 'hyperswarm';
import DHT from 'hyperdht';
import Hypercore from 'hypercore';
import Hyperbee from 'hyperbee';
import crypto from 'crypto';

export default class Server {
  constructor(dbPath = './db/rpc-server') {
    this.hcore = new Hypercore(dbPath)
    this.hbee = new Hyperbee(this.hcore, { keyEncoding: 'utf-8', valueEncoding: 'binary' })
    this.network = null;
    this.dht = null;
  }

  createHash(title) {
    return crypto.createHash('sha256').update(Buffer.from(title, 'utf-8')).digest();
  }

  async handleAuctionOperation(operation, inHbee) {
    const auction_json = (await this.hbee.get(inHbee.toString('hex')))?.value
    if (!auction_json) return
    const auction = JSON.parse(auction_json)

    switch (operation.command) {
      default:
      case 'auction':
        auction.highestBid = operation.amount
        auction.client = operation.client
        await this.hbee.put(inHbee.toString('hex'), JSON.stringify(auction))
        break

      case 'settle':
        auction.status = 'SETTLED'
        await this.hbee.put(inHbee.toString('hex'), JSON.stringify(auction))
        break
    }
  }

  async start() {
    await this.hbee.ready()

    let dhtSeed = (await this.hbee.get('dht-seed'))?.value
    if (!dhtSeed) {
      dhtSeed = crypto.randomBytes(32)
      await this.hbee.put('dht-seed', dhtSeed)
    }

    this.dht = new DHT({
      port: 40001,
      keyPair: DHT.keyPair(dhtSeed),
      bootstrap: [{ host: '127.0.0.1', port: 30001 }] // note boostrap points to dht that is started via cli
    })
    await this.dht.ready()

    this.network = new Hyperswarm({ dht: this.dht })

    this.network.on('connection', (peer) => {
      const name = b4a.toString(peer.remotePublicKey, 'hex').substr(0, 8)

      peer.on('data', async (message) => {
        try {
          const operation = JSON.parse(message)

          const topic = operation.topic
          const inHbee = (await this.hbee.get(topic))?.value
          if (!inHbee) return;

          await this.handleAuctionOperation(operation, inHbee)
        }
        catch (e) { }
      })

      peer.on('error', e => console.log(`Connection error: ${e}`))
    })

    let rpcSeed = (await this.hbee.get('rpc-seed'))?.value
    if (!rpcSeed) {
      rpcSeed = crypto.randomBytes(32)
      await this.hbee.put('rpc-seed', rpcSeed)
    }

    const rpc = new RPC({ seed: rpcSeed, dht: this.dht })
    const rpcServer = rpc.createServer()
    await rpcServer.listen()

    console.log('rpc server started listening on public key:', rpcServer.publicKey.toString('hex'))

    rpcServer.respond('ping', this.ping.bind(this))
    rpcServer.respond('create', this.create.bind(this))
    rpcServer.respond('join', this.join.bind(this))
    rpcServer.respond('leave', this.leave.bind(this))
    rpcServer.respond('auction', this.auction.bind(this))
    rpcServer.respond('settle', this.settle.bind(this))

    return rpcServer.publicKey;
  }
  
  async ping(reqRaw) {
    console.log('Ping RPC called')
    const req = JSON.parse(reqRaw.toString('utf-8'))
    const resp = { nonce: req.nonce + 1 }
    const respRaw = Buffer.from(JSON.stringify(resp), 'utf-8')
    return respRaw
  }

  async create(reqRaw) {
    console.log('Create RPC called')
    const req = JSON.parse(reqRaw.toString('utf-8'))
    if (!req.title || !req.amount) {
      return Buffer.from(JSON.stringify('Missing fields'), 'utf-8')
    }

    const titleHash = this.createHash(req.title);
    
    const auctionData = {
      title: req.title,
      amount: req.amount,
      id: titleHash.toString('hex'),
      highestBid: 0,
      client: null,
      status: 'OPEN'
    }
    const auctionHash = this.createHash(JSON.stringify(auctionData));
    await this.hbee.put(auctionHash.toString('hex'), JSON.stringify(auctionData))
    await this.hbee.put(titleHash.toString('hex'), auctionHash.toString('hex'))
    const channel = this.network.join(titleHash, { client: true, server: true })
    await channel.flushed()

    return Buffer.from(JSON.stringify('OK'), 'utf-8')
  }

  async join(reqRaw) {
    console.log('Join RPC called')

    const req = JSON.parse(reqRaw.toString('utf-8'))
    if (!req.title) {
      return Buffer.from(JSON.stringify('Missing fields'), 'utf-8')
    }
    const titleHash = this.createHash(req.title);

    const channel = this.network.join(titleHash, { client: true, server: true })
    await channel.flushed()

    return Buffer.from(JSON.stringify('OK'), 'utf-8')
  }

  async leave(reqRaw) {
    console.log('Leave RPC called')

    const req = JSON.parse(reqRaw.toString('utf-8'))
    if (!req.title) {
      return Buffer.from(JSON.stringify('Missing fields'), 'utf-8')
    }
    const channelId = this.createHash(req.title);
    await this.network.leave(channelId)

    return Buffer.from(JSON.stringify('OK'), 'utf-8')
  }

  async auction(reqRaw) {
    console.log('Auction RPC called')
    const req = JSON.parse(reqRaw.toString('utf-8'))

    if (!req.title || !req.amount, req.client) {
      return Buffer.from(JSON.stringify('Missing fields'), 'utf-8')
    }

    const topicId = this.createHash(req.title);
    const peers = [...this.network.connections]
    for (const peer of peers) peer.write(JSON.stringify({ command: 'auction', topic: topicId.toString('hex'), amount: req.amount, client: req.client }))

    return Buffer.from(JSON.stringify('OK'), 'utf-8')
  }

  async settle(reqRaw) {
    console.log('Settle RPC called')

    const req = JSON.parse(reqRaw.toString('utf-8'))
    if (!req.title) {
      return Buffer.from(JSON.stringify('Missing fields'), 'utf-8')
    }

    const topicId = this.createHash(req.title);
    const peers = [...this.network.connections]
    const auctionInfo = this.hbee.get(topicId.toString('hex'))
    for (const peer of peers) {
      peer.write(JSON.stringify({ command: 'settle', topic: topicId.toString('hex'), client: auctionInfo.client, amount: auctionInfo.highestBid}))
    }
    return Buffer.from(JSON.stringify('OK'), 'utf-8')
  }
}
