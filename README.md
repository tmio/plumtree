# Plumtree - Push-Lazy-pUsh Multicast TREE, an implementation of Epidemic Broadcast Tree, in Typescript


# API

This project is a library you can embed into any application to provide gossiping capabilities using the [Plumtree](http://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.190.3504&rep=rep1&type=pdf) paper algorithm.

## [`Peer`](src/peer.ts)

The API defines the notion of a peer as a simple interface.

You can define your own peer attached to a network resource or an identifier.

## [`PeerRepository`](src/peerRepository.ts)

Defines a peer repository that is used to store peers for the duration. The peer repository can have a persistence or clustering strategy - that's out of scope of the library.

The library helpfully defines an `EphemeralPeerRepository`, which keeps peers in memory.

## [`messageHashingFunction`](src/state.ts#29)

The message hashing function used to uniquely determine a hash for a message.
The message hash is used to send attestations to other peers using the IHAVE messages.

## [`messageSender`](src/state.ts#30)

The function to send messages. This is the interface to the network.

## [`messageValidator`](src/state.ts#31)

The function validating messages when receiving them before sending them to other peers. This is optional. By default no validation takes place.

## [`graftDelay`](src/state.ts#32)

The amount of time in milliseconds before a GRAFT message is sent to a peer.
This occurs when a message attestation is received, but no full message was received.
The default value is 5000.

## [`lazyQueueInterval`](src/state.ts#33)

The interval in milliseconds at which attestations should be lazily sent to other peers.
The default value is 5000.

# License

Copyright 2019 Antoine Toulme

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.