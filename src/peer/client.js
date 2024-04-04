'use strict'

import RPC from '@hyperswarm/rpc';
import DHT from 'hyperdht';
import Hypercore from 'hypercore';
import Hyperbee from 'hyperbee';
import crypto from 'crypto';

export default class Client {
  constructor(serverPub, dbPath = './db/rpc-client') {
    this.serverPubKey = Buffer.from(serverPub);
    this.hcore = new Hypercore(dbPath)
  }

  async connect() {

    console.log('client connecting to serverPubKey = ', this.serverPubKey.toString('hex'))
    this.hbee = new Hyperbee(this.hcore, { keyEncoding: 'utf-8', valueEncoding: 'binary' })
    await this.hbee.ready()

    let dhtSeed = (await this.hbee.get('dht-seed'))?.value
    if (!dhtSeed) {
      dhtSeed = crypto.randomBytes(32)
      await this.hbee.put('dht-seed', dhtSeed)
    }

    this.dht = new DHT({
      port: 50001,
      keyPair: DHT.keyPair(dhtSeed),
      bootstrap: [{ host: '127.0.0.1', port: 30001 }]
    })
    await this.dht.ready()

    this.rpc = new RPC({ dht: this.dht })
  }

  async disconnect() {
    await this.rpc.destroy()
    await this.dht.destroy()
  }

  async ping() {
    const payload = { nonce: 152 }
    const payloadRaw = this.convertObjectToBuffer(payload)

    const responseBuffer = await this.rpc.request(this.serverPubKey, 'ping', payloadRaw)
    const response = this.parseBuffer(responseBuffer)
    return response;
  }

  async create(title, amount) {
    const responseBuffer = await this.rpc.request(this.serverPubKey, 'create', this.convertObjectToBuffer({
      title,
      amount
    }))
    const response = this.parseBuffer(responseBuffer)
    return response;
  }

  async join(title) {
    const responseBuffer = await this.rpc.request(this.serverPubKey, 'join', this.convertObjectToBuffer({
      title,
    }))
    const response = this.parseBuffer(responseBuffer)
    return response;
  }

  async leave(title) {
    const responseBuffer = await this.rpc.request(this.serverPubKey, 'leave', this.convertObjectToBuffer({
      title,
    }))
    const response = this.parseBuffer(responseBuffer)
    return response;
  }

  async auction(title, amount, client) {
    const responseBuffer = await this.rpc.request(this.serverPubKey, 'auction', this.convertObjectToBuffer({
      title,
      amount,
      client,
    }))
    const response = this.parseBuffer(responseBuffer)
    return response;
  }

  async settle(title) {
    const responseBuffer = await this.rpc.request(this.serverPubKey, 'settle', this.convertObjectToBuffer({
      title,
    }))
    const response = this.parseBuffer(responseBuffer)
    return response;
  }

  convertObjectToBuffer(json) {
    return Buffer.from(JSON.stringify(json), 'utf-8')
  }

  parseBuffer(buffer) {
    return JSON.parse(buffer.toString('utf-8'))
  }
}
