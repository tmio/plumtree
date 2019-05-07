import {Peer} from "./peer";
import {PeerRepository} from "./peerRepository";

/**
 * In-memory peer repository.
 */
export class EphemeralPeerRepository implements PeerRepository {

  eagers: Set<Peer>;
  lazys: Set<Peer>;

  constructor() {
    this.eagers = new Set<Peer>();
    this.lazys = new Set<Peer>();
  }

  addEager(peer: Peer) {
    this.eagers.add(peer);
  }

  peers() {
    return Array.from(this.eagers).concat(Array.from(this.lazys));
  }

  removePeer(peer: Peer) {
    this.lazys.delete(peer);
    this.eagers.delete(peer);
  }

  moveToLazy(peer: Peer) {
    this.eagers.delete(peer);
    this.lazys.add(peer);
  }

  moveToEager(peer: Peer) {
    this.lazys.delete(peer);
    this.eagers.add(peer);
  }

  considerNewPeer(peer: Peer) {
    if (!this.lazys.has(peer)) {
      this.eagers.add(peer);
    }
  }

  eagerPushPeers(): Peer[] {
    return Array.from(this.eagers);
  }

  lazyPushPeers(): Peer[] {
    return Array.from(this.lazys);
  }
}