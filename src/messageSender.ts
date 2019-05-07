import {Buffer} from 'buffer';
import {Peer} from "./peer";

/**
 * Types of verbs supported by the dialect
 */
export enum Verb {
  IHAVE, GRAFT, PRUNE, GOSSIP
}

/**
 * Interface to sending messages to other peers.
 */
export interface MessageSender {

  /**
   * Sends bytes to a peer.
   *
   * @param verb the type of message
   * @param attributes the attributes of message
   * @param peer the target of the message
   * @param hash the hash of the message
   * @param payload the bytes to send
   */
  sendMessage(verb: Verb, attributes: String | null, peer: Peer, hash: Buffer, payload: Buffer | null): void

}
