// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Testnet-only relayer anchor. The operator is immutable and cannot move user assets.
contract ReceiptAnchor {
    address public immutable relayer;
    mapping(bytes32 => bool) public anchored;
    event ReceiptAnchored(bytes32 indexed receiptHash, address indexed relayer);
    constructor(address initialRelayer) { require(initialRelayer != address(0), "zero relayer"); relayer = initialRelayer; }
    function anchor(bytes32 receiptHash) external { require(msg.sender == relayer, "relayer only"); require(!anchored[receiptHash], "already anchored"); anchored[receiptHash] = true; emit ReceiptAnchored(receiptHash, msg.sender); }
}
