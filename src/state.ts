import {PeerRepository} from "./peerRepository";
import {Buffer} from 'buffer';
import {MessageSender, Verb} from "./messageSender";
import {Peer} from "./peer";
// tslint:disable-next-line
const LRUCache = require('lru-cache');

/**
 * Local state to our peer, representing the make-up of the tree of peers.
 */
export class State {

    peerRepository : PeerRepository;
    messageHashingFunction : (message: Buffer) => Buffer;
    messageSender : MessageSender;
    messageListener : (message : Buffer) => void;
    messageValidator : (message : Buffer, peer : Peer) => boolean;
    delay: number;
    lazyQueueInterval : number;
    lazyQueue = new Set<() => void>();
    readonly interval : any;
    // @ts-ignore
    messageHandlers = new LRUCache<Buffer, MessageHandler>(1000000);

    /**
     * Constructor building a plumtree state.
     *
     * @param peerRepository the peer repository to use to store and access peer information.
     * @param messageHashingFunction the function to use to hash messages into hashes to compare them.
     * @param messageSender a function abstracting sending messages to other peers.
     * @param messageListener a function consuming messages when they are gossiped.
     * @param messageValidator a function validating messages before they are gossiped to other peers.
     * @param graftDelay delay in milliseconds to apply before this peer grafts an other peer when it finds that peer has
     *        data it misses.
     * @param lazyQueueInterval the interval in milliseconds between sending messages to lazy peers.
     */
    constructor(peerRepository : PeerRepository, messageHashingFunction : (message: Buffer) => Buffer,
     messageSender : MessageSender,
    messageListener : (message : Buffer) => void,
     messageValidator : (message : Buffer, peer : Peer) => boolean = (msg, peer) => true,
                graftDelay : number = 5000,
                lazyQueueInterval : number = 5000) {
        this.peerRepository = peerRepository;
        this.messageHashingFunction = messageHashingFunction;
        this.messageSender = messageSender;
        this.messageListener = messageListener;
        this.messageValidator = messageValidator;
        this.delay = graftDelay;
        this.lazyQueueInterval = 5000;
        this.interval = setInterval(() => {
            this.processQueue();
        }, lazyQueueInterval);
    }

    processQueue() {
        let toDelete = new Set<() => void>();
        this.lazyQueue.forEach(function(item){
            item();
            toDelete.add(item);
        });
        for (let item of Array.from(toDelete.values())) {
            this.lazyQueue.delete(item);
        }
    }

    /**
     * Adds a new peer to this state.
     *
     * @param peer the new peer
     */
    addPeer(peer : Peer) {
        this.peerRepository.addEager(peer);
    }

    /**
     * Removes a peer from the collection of peers we are connected to.
     *
     * @param peer the peer to remove
     */
    removePeer(peer : Peer) {
        this.peerRepository.removePeer(peer);
    }

    /**
     * Stops the gossip network state, cancelling all in progress tasks.
     */
    stop() {
        clearInterval(this.interval);
    }

/**
 * Records a message was received in full from a peer.
 *
 * @param peer the peer that sent the message
 * @param attributes of the message
 * @param message the hash of the message
 */
receiveGossipMessage(peer : Peer, attributes : String, message : Buffer) {
    this.peerRepository.considerNewPeer(peer);
    let handler = this.computeIfAbsent(this.messageHashingFunction(message));
    handler.fullMessageReceived(peer, attributes, message);
}

/**
 * Records a message was partially received from a peer.
 *
 * @param peer the peer that sent the message
 * @param messageHash the hash of the message
 */
receiveIHaveMessage(peer : Peer, messageHash : Buffer) {
    let handler = this.computeIfAbsent(messageHash);
    handler.partialMessageReceived(peer);
}

/**
 * Requests a peer be pruned away from the eager peers into the lazy peers
 *
 * @param peer the peer to move to lazy peers
 */
receivePruneMessage(peer : Peer) {
    this.peerRepository.moveToLazy(peer);
}

/**
 * Requests a peer be grafted to the eager peers list
 *
 * @param peer the peer to add to the eager peers
 * @param messageHash the hash of the message that triggers this grafting
 */
receiveGraftMessage(peer : Peer, messageHash : Buffer) {
    this.peerRepository.moveToEager(peer);
    this.messageSender.sendMessage(Verb.GOSSIP, null, peer, messageHash, null);
}

/**
 * Sends a gossip message to all peers, according to their status.
 *
 * @param message the message to propagate
 * @param attributes of the message
 * @return The associated hash of the message
 */
public sendGossipMessage(attributes : String, message : Buffer) : Buffer {
    let messageHash = this.messageHashingFunction(message);
    let handler = this.computeIfAbsent(messageHash);
    handler.fullMessageReceived(null, attributes, message);
    return messageHash;
}

private computeIfAbsent(messageHash : Buffer) : MessageHandler {
    let handler = this.messageHandlers.get(messageHash);
    if (handler == null) {
        let newHandler = new MessageHandler(this.delay, this.lazyQueue, this.messageListener,  this.messageSender, this.peerRepository, this.messageValidator, messageHash);
        this.messageHandlers.set(messageHash, newHandler);
        return newHandler;
    }
    return handler;

}

}

class MessageHandler {

    hash : Buffer;
    peerRepository : PeerRepository;
    messageValidator : (message : Buffer, peer : Peer) => boolean;
    messageSender : MessageSender;
    messageListener : (message : Buffer) => void;
    lazyQueue : Set<() => void>;
    receivedFullMessage = false;
    requestingGraftMessage = false;
    lazyPeers = new Array<Peer>();
    delay : number;
    graftInterval : any;

    constructor(delay: number, lazyQueue : Set<() => void>, messageListener : (message : Buffer) => void, messageSender: MessageSender, peerRepository : PeerRepository, messageValidator : (message : Buffer, peer : Peer) => boolean, hash : Buffer) {
        this.hash = hash;
        this.peerRepository = peerRepository;
        this.messageValidator = messageValidator;
        this.messageSender = messageSender;
        this.messageListener = messageListener;
        this.lazyQueue = lazyQueue;
        this.delay = delay;
    }

    /**
     * Acts on receiving the full message
     *
     * @param sender the sender - may be null if we are submitting this message to the network
     * @param attributes the attributes to add to the message
     * @param message the payload to send to the network
     */
    fullMessageReceived(sender : Peer | null, attributes : String, message : Buffer) {
        if (this.receivedFullMessage == false) {
            this.receivedFullMessage = true;
            clearTimeout(this.graftInterval);

            if (sender == null || this.messageValidator(message, sender)) {
                for (let peer of Array.from(this.peerRepository.eagerPushPeers())) {
                    if (sender == null || sender != peer) {
                        this.messageSender.sendMessage(Verb.GOSSIP, attributes, peer, this.hash, message);
                    }
                }
                for (let peer of Array.from(this.peerRepository.lazyPushPeers())) {
                    if (this.lazyPeers.indexOf(peer) == -1) {
                        this.lazyQueue.add(() => {
                            this.messageSender
                                .sendMessage(Verb.IHAVE, null, peer, this.hash, null);
                        });
                    }
                }
                if (sender != null) {
                    this.messageListener(message);
                }
            }
        } else {
            if (sender != null) {
                this.messageSender.sendMessage(Verb.PRUNE, null, sender, this.hash, null);
                this.peerRepository.moveToLazy(sender);
            }
        }
    }

    private scheduleGraftMessage(index : number) {
        let scheduled = () => {
            var newPeerIndex = index;
            if (newPeerIndex == this.lazyPeers.length) {
                newPeerIndex = 0;
            }
            this.messageSender.sendMessage(Verb.GRAFT, null, this.lazyPeers[index], this.hash, null);
            this.scheduleGraftMessage(newPeerIndex++);
        };
        this.graftInterval = setTimeout(scheduled, this.delay);
    }

partialMessageReceived(peer : Peer) {
    if (!this.receivedFullMessage) {
        this.lazyPeers.push(peer);
        if (!this.requestingGraftMessage) {
            this.requestingGraftMessage = true;
            this.scheduleGraftMessage(0);
        }
    }
}
}