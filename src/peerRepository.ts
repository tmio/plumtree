import {Peer} from "./peer";

/**
 * Repository of active peers associated with a gossip tree.
 */
export interface PeerRepository {

  addEager(peer: Peer): void

  /**
   * Provides the list of all the peers connected.
   *
   * @return the list of peers
   */
  peers(): Peer[]

  /**
   * Provides the list of all lazy peers connected.
   *
   * @return the list of peers to push to lazily
   */
  lazyPushPeers(): Peer[]

  /**
   * Provides the list of all eager peers connected.
   *
   * @return the list of peers to push to eagerly
   */
  eagerPushPeers(): Peer[]

  /**
   * Removes a peer from the repository
   *
   * @param peer the peer to remove
   */
  removePeer(peer: Peer): void

  /**
   * Moves a peer to the list of lazy peers
   *
   * @param peer the peer to move
   */
  moveToLazy(peer: Peer): void

  /**
   * Moves a peer to the list of eager peers.
   *
   * @param peer the peer to move
   */
  moveToEager(peer: Peer): void

  /**
   * Proposes a peer as a new peer.
   *
   * @param peer a peer to be considered for addition
   */
  considerNewPeer(peer: Peer): void
}
