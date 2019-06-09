import {Peer} from "../src/peer";
import {MessageSender, Verb} from "../src/messageSender";
import {EphemeralPeerRepository} from "../src/ephemeralPeerRepository";
import {State} from "../src/state";
import {assert} from "chai";
import {randomBytes} from "crypto";

class MockMessageSender implements MessageSender {

  verb: Verb | undefined;
  attributes: String | undefined;
  peer: Peer | undefined;
  hash: Buffer | undefined;
  payload: Buffer | undefined;

  sendMessage(verb: Verb, attributes: String, peer: Peer, hash: Buffer, payload: Buffer) {
    this.verb = verb;
    this.attributes = attributes;
    this.peer = peer;
    this.hash = hash;
    this.payload = payload;
  }
}

class PeerImpl implements Peer {

}

describe('State tests', () => {

  var messageCaptured: Buffer;

  it('should have initial state', () => {
    let repo = new EphemeralPeerRepository();
    let state = new State(repo, (message => message), new MockMessageSender(), (buf => {
      messageCaptured = buf;
    }));
    assert.isTrue(repo.lazyPushPeers().length == 0);
    assert.isTrue(repo.eagerPushPeers().length == 0);
    assert.isTrue(repo.peers().length == 0);
    state.stop();
  });

  it('firstRoundWithThreePeers', () => {
    let repo = new EphemeralPeerRepository();
    let state = new State(repo, (message => message), new MockMessageSender(), (buf => {
      messageCaptured = buf;
    }));
    state.addPeer(new PeerImpl());
    state.addPeer(new PeerImpl());
    state.addPeer(new PeerImpl());
    assert.isTrue(repo.lazyPushPeers().length == 0);
    assert.equal(3, repo.eagerPushPeers().length);
    state.stop();
  });

  it('firstRoundWithTwoPeers', () => {
    let repo = new EphemeralPeerRepository();
    let state = new State(repo, (message => message), new MockMessageSender(), (buf => {
      messageCaptured = buf;
    }));
    state.addPeer(new PeerImpl());
    state.addPeer(new PeerImpl());
    assert.isTrue(repo.lazyPushPeers().length == 0);
    assert.equal(2, repo.eagerPushPeers().length);
    state.stop();
  });

  it('firstRoundWithOnePeer', () => {
    let repo = new EphemeralPeerRepository();
    let state = new State(repo, (message => message), new MockMessageSender(), (buf => {
      messageCaptured = buf;
    }));
    state.addPeer(new PeerImpl());
    assert.isTrue(repo.lazyPushPeers().length == 0);
    assert.equal(1, repo.eagerPushPeers().length);
    state.stop();
  });

  it('removePeer', () => {
    let repo = new EphemeralPeerRepository();
    let state = new State(repo, (message => message), new MockMessageSender(), (buf => {
      messageCaptured = buf;
    }));
    let peer = new PeerImpl();
    state.addPeer(peer);
    state.removePeer(peer);
    assert.isTrue(repo.peers().length == 0);
    assert.isTrue(repo.lazyPushPeers().length == 0);
    assert.isTrue(repo.eagerPushPeers().length == 0);
    state.stop();
  });

  it('prunePeer', () => {
    let repo = new EphemeralPeerRepository();
    let state = new State(repo, (message => message), new MockMessageSender(), (buf => {
      messageCaptured = buf;
    }));
    let peer = new PeerImpl();
    state.addPeer(peer);
    state.receivePruneMessage(peer);
    assert.equal(0, repo.eagerPushPeers().length);
    assert.equal(1, repo.lazyPushPeers().length);
    state.stop();
  });

  it('graftPeer', () => {
    let repo = new EphemeralPeerRepository();
    let state = new State(repo, (message => message), new MockMessageSender(), (buf => {
      messageCaptured = buf;
    }));
    let peer = new PeerImpl();
    state.addPeer(peer);
    state.receivePruneMessage(peer);
    assert.equal(0, repo.eagerPushPeers().length);
    assert.equal(1, repo.lazyPushPeers().length);
    state.receiveGraftMessage(peer, randomBytes(32));
    assert.equal(1, repo.eagerPushPeers().length);
    assert.equal(0, repo.lazyPushPeers().length);
    state.stop();
  });

  it('receiveFullMessageFromEagerPeer', () => {
    let repo = new EphemeralPeerRepository();
    let messageSender = new MockMessageSender();
    let state = new State(repo, (message => message), messageSender, (buf => {
      messageCaptured = buf;
    }));
    let peer = new PeerImpl();
    state.addPeer(peer);
    let otherPeer = new PeerImpl();
    state.addPeer(otherPeer);
    let msg = randomBytes(32);
    let attributes = "{\"message_type\": \"BLOCK\"}";
    state.receiveGossipMessage(peer, attributes, msg);
    assert.equal(msg, messageSender.payload);
    assert.equal(otherPeer, messageSender.peer);
    state.stop();
  });

  it('receiveFullMessageFromEagerPeerWithALazyPeer', () => {
    let repo = new EphemeralPeerRepository();
    let messageSender = new MockMessageSender();
    let state = new State(repo, (message => message), messageSender, (buf => {
      messageCaptured = buf;
    }));
    let peer = new PeerImpl();
    state.addPeer(peer);
    let otherPeer = new PeerImpl();
    state.addPeer(otherPeer);
    let msg = randomBytes(32);
    let lazyPeer = new PeerImpl();
    state.addPeer(lazyPeer);
    repo.moveToLazy(lazyPeer);
    let attributes = "{\"message_type\": \"BLOCK\"}";
    state.receiveGossipMessage(peer, attributes, msg);
    assert.equal(msg, messageSender.payload);
    assert.equal(otherPeer, messageSender.peer);
    state.processQueue();
    assert.equal(msg, messageSender.hash);
    assert.equal(lazyPeer, messageSender.peer);
    assert.equal(Verb.IHAVE, messageSender.verb);
    state.stop();
  });

  it('receiveFullMessageFromEagerPeerThenPartialMessageFromLazyPeer', () => {
    let repo = new EphemeralPeerRepository();
    let messageSender = new MockMessageSender();
    let state = new State(repo, (message => message), messageSender, (buf => {
      messageCaptured = buf;
    }));
    let peer = new PeerImpl();
    state.addPeer(peer);
    let lazyPeer = new PeerImpl();
    state.addPeer(lazyPeer);
    repo.moveToLazy(lazyPeer);
    let message = randomBytes(32);
    let attributes = "{\"message_type\": \"BLOCK\"}";
    state.receiveGossipMessage(peer, attributes, message);
    state.receiveIHaveMessage(lazyPeer, message);
    assert.isUndefined(messageSender.payload);
    assert.isUndefined(messageSender.peer);
    state.stop();
  });

  it('receivePartialMessageFromLazyPeerAndNoFullMessage', () => {
    let repo = new EphemeralPeerRepository();
    let messageSender = new MockMessageSender();
    let state = new State(repo, (message => message), messageSender, (buf => {
      messageCaptured = buf;
    }), () => true, 100, 4000);
    let peer = new PeerImpl();
    state.addPeer(peer);
    let lazyPeer = new PeerImpl();
    state.addPeer(lazyPeer);
    repo.moveToLazy(lazyPeer);
    let message = randomBytes(32);
    state.receiveIHaveMessage(lazyPeer, message);
    // await 200;
    setTimeout(() => {
      assert.equal(message, messageSender.hash);
      assert.equal(lazyPeer, messageSender.peer);
      assert.equal(Verb.GRAFT, messageSender.verb);
      state.stop();
    }, 200);

  });

  it('receivePartialMessageFromLazyPeerAndThenFullMessage', () => {
    let repo = new EphemeralPeerRepository();
    let messageSender = new MockMessageSender();
    let state = new State(repo, (message => message), messageSender, (buf => {
      messageCaptured = buf;
    }), () => true, 500, 4000);
    let peer = new PeerImpl();
    state.addPeer(peer);
    let lazyPeer = new PeerImpl();
    state.addPeer(lazyPeer);
    repo.moveToLazy(lazyPeer);
    let message = randomBytes(32);
    state.receiveIHaveMessage(lazyPeer, message);
    // await 100;
    setTimeout(() => {
      let attributes = "{\"message_type\": \"BLOCK\"}";
      state.receiveGossipMessage(peer, attributes, message);
      // await 500;
      setTimeout(() => {
        assert.isUndefined(messageSender.verb);
        assert.isUndefined(messageSender.payload);
        assert.isUndefined(messageSender.peer);
        state.stop();
      }, 500);
    }, 100);
  });

  it('receiveFullMessageFromUnknownPeer', () => {
    let repo = new EphemeralPeerRepository();
    let messageSender = new MockMessageSender();
    let state = new State(repo, (message => message), messageSender, (buf => {
      messageCaptured = buf;
    }));
    let peer = new PeerImpl();
    let message = randomBytes(32);
    let attributes = "{\"message_type\": \"BLOCK\"}";
    state.receiveGossipMessage(peer, attributes, message);
    assert.equal(1, repo.eagerPushPeers().length);
    assert.equal(0, repo.lazyPushPeers().length);
    assert.equal(peer, repo.eagerPushPeers()[0]);
    state.stop();
  });

  it('prunePeerWhenReceivingTwiceTheSameFullMessage', () => {
    let repo = new EphemeralPeerRepository();
    let messageSender = new MockMessageSender();
    let state = new State(repo, (message => message), messageSender, (buf => {
      messageCaptured = buf;
    }));
    let peer = new PeerImpl();
    let secondPeer = new PeerImpl();
    let message = randomBytes(32);
    let attributes = "{\"message_type\": \"BLOCK\"}";
    state.receiveGossipMessage(peer, attributes, message);
    state.receiveGossipMessage(secondPeer, attributes, message);
    assert.equal(2, repo.eagerPushPeers().length);
    assert.equal(0, repo.lazyPushPeers().length);
    assert.isNull(messageSender.payload);
    assert.equal(secondPeer, messageSender.peer);
    assert.equal(Verb.PRUNE, messageSender.verb);
    state.stop();
  });
});
