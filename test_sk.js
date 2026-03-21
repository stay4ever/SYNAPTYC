const Module = require('module');
const origResolve = Module._resolveFilename;
Module._resolveFilename = function(request, parent, ...rest) {
  if (request.startsWith('@noble/hashes/') && !request.endsWith('.js')) {
    return origResolve.call(this, request + '.js', parent, ...rest);
  }
  return origResolve.call(this, request, parent, ...rest);
};

const SIG = require('./src/signal_protocol.js');
let sender = SIG.skGenerate();
let receiver = SIG.deserialiseSKState(SIG.serialiseSKState(sender));

let {newState, envelope} = SIG.skEncrypt(sender, "hello", "alice");
sender = newState;

// Let's create an out of order message that decrypts but doesn't bump the receiver properly?
// When a receiver receives out of order:
let {newState: st2, envelope: env2} = SIG.skEncrypt(sender, "msg2", "alice");

let resOutOfOrder = SIG.skDecrypt(receiver, env2);
console.log("resOutOfOrder plaintext:", resOutOfOrder.plaintext);
receiver = resOutOfOrder.newSenderKeyState; // Recever advances to iteration 2

let resMissed = SIG.skDecrypt(receiver, envelope); // Try to decrypt iteration 1 (envelope)
console.log("resMissed:", resMissed); // Should return null because it dropped.

