/**
 * Minimal WebSocket server — pure Node.js, zero dependencies
 * Implements RFC 6455 (WebSocket protocol)
 */
const crypto = require('crypto');
const { EventEmitter } = require('events');

const WS_MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function createAcceptKey(key) {
  return crypto.createHash('sha1').update(key + WS_MAGIC).digest('base64');
}

function encodeFrame(data) {
  const isString = typeof data === 'string';
  const payload = isString ? Buffer.from(data, 'utf8') : data;
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = isString ? 0x81 : 0x82;
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = isString ? 0x81 : 0x82;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = isString ? 0x81 : 0x82;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

function decodeFrames(buf) {
  const messages = [];
  let offset = 0;
  while (offset < buf.length) {
    if (buf.length - offset < 2) break;
    const fin = (buf[offset] & 0x80) !== 0;
    const opcode = buf[offset] & 0x0f;
    offset++;
    const masked = (buf[offset] & 0x80) !== 0;
    let payloadLen = buf[offset] & 0x7f;
    offset++;
    if (payloadLen === 126) {
      if (buf.length - offset < 2) break;
      payloadLen = buf.readUInt16BE(offset); offset += 2;
    } else if (payloadLen === 127) {
      if (buf.length - offset < 8) break;
      payloadLen = Number(buf.readBigUInt64BE(offset)); offset += 8;
    }
    let maskKey = null;
    if (masked) {
      if (buf.length - offset < 4) break;
      maskKey = buf.slice(offset, offset + 4); offset += 4;
    }
    if (buf.length - offset < payloadLen) break;
    let payload = buf.slice(offset, offset + payloadLen); offset += payloadLen;
    if (masked && maskKey) {
      for (let i = 0; i < payload.length; i++) payload[i] ^= maskKey[i % 4];
    }
    if (opcode === 0x1) messages.push({ type: 'text', data: payload.toString('utf8') });
    else if (opcode === 0x8) messages.push({ type: 'close' });
    else if (opcode === 0x9) messages.push({ type: 'ping' });
  }
  return messages;
}

class WSClient extends EventEmitter {
  constructor(socket) {
    super();
    this.socket = socket;
    this._buf = Buffer.alloc(0);
    this.alive = true;
    socket.on('data', (chunk) => {
      this._buf = Buffer.concat([this._buf, chunk]);
      const msgs = decodeFrames(this._buf);
      this._buf = Buffer.alloc(0); // simple: reset (good enough for our use)
      msgs.forEach(m => {
        if (m.type === 'close') { this.alive = false; this.emit('close'); }
        else if (m.type === 'text') this.emit('message', m.data);
      });
    });
    socket.on('error', () => { this.alive = false; this.emit('close'); });
    socket.on('end', () => { this.alive = false; this.emit('close'); });
  }
  send(data) {
    if (!this.alive) return;
    try { this.socket.write(encodeFrame(data)); } catch(e) {}
  }
  close() { this.alive = false; try { this.socket.destroy(); } catch(e) {} }
}

function attachWebSocket(server, onConnect) {
  server.on('upgrade', (req, socket) => {
    if (req.headers['upgrade']?.toLowerCase() !== 'websocket') {
      socket.destroy(); return;
    }
    const key = req.headers['sec-websocket-key'];
    const accept = createAcceptKey(key);
    socket.write([
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${accept}`,
      '\r\n'
    ].join('\r\n'));
    const client = new WSClient(socket);
    onConnect(client);
  });
}

module.exports = { attachWebSocket };
