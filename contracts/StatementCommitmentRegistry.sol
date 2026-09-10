// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Minimal receipt registry. It never moves assets or executes arbitrary calls.
contract StatementCommitmentRegistry {
    mapping(bytes32 => bool) public committed;
    event StatementCommitted(bytes32 indexed reportHash, bytes32 indexed actionId, address indexed committer);

    function commit(bytes32 reportHash, bytes32 actionId) external {
        bytes32 key = keccak256(abi.encode(reportHash, actionId, msg.sender));
        require(!committed[key], "already committed");
        committed[key] = true;
        emit StatementCommitted(reportHash, actionId, msg.sender);
    }
}
