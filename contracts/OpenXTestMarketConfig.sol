// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IIrm} from "morpho-blue/src/interfaces/IIrm.sol";
import {IOracle} from "morpho-blue/src/interfaces/IOracle.sol";
import {Market, MarketParams} from "morpho-blue/src/interfaces/IMorpho.sol";

/// @notice Immutable 1:1 USDC/USDC oracle for the OpenX Arbitrum Sepolia test market.
contract OpenXTestnetUsdcOracle is IOracle {
    function price() external pure returns (uint256) { return 1e36; }
}

/// @notice Zero-rate IRM for the OpenX Arbitrum Sepolia test market.
contract OpenXTestnetZeroIrm is IIrm {
    function borrowRate(MarketParams memory, Market memory) external pure returns (uint256) { return 0; }
    function borrowRateView(MarketParams memory, Market memory) external pure returns (uint256) { return 0; }
}
