// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

struct MarketParams { address loanToken; address collateralToken; address oracle; address irm; uint256 lltv; }

interface IMorphoBlue {
    function supplyCollateral(MarketParams memory marketParams, uint256 assets, address onBehalf, bytes calldata data) external;
}

interface IPermit2 {
    struct TokenPermissions { address token; uint256 amount; }
    struct PermitTransferFrom { TokenPermissions permitted; uint256 nonce; uint256 deadline; }
    struct SignatureTransferDetails { address to; uint256 requestedAmount; }
    function permitTransferFrom(PermitTransferFrom calldata permit, SignatureTransferDetails calldata transferDetails, address owner, bytes calldata signature) external;
}

/// @notice A fixed-market, non-custodial Arbitrum Sepolia allocation adapter.
/// @dev The 1inch router is trusted but never receives a caller-selected target address.
contract OpenXAllocationZap {
    error InvalidAddress(); error InvalidMarket(); error InvalidToken(); error InvalidPermit(); error Expired(); error Reentrant();
    error SlippageExceeded(uint256 minimum, uint256 received); error RouterCallFailed(); error TransferFailed();

    address public immutable sourceToken;
    address public immutable collateralToken;
    address public immutable morphoBlue;
    address public immutable oneInchRouter;
    IPermit2 public immutable permit2;
    MarketParams public marketParams;
    bool private locked;

    event AllocatedToMorpho(address indexed user, bytes32 indexed reportHash, bytes32 indexed marketId, uint256 sourceAmount, uint256 collateralSupplied);

    struct AllocationRequest { uint256 sourceAmount; uint256 minCollateralAmount; uint256 deadline; bytes32 reportHash; bytes routerCalldata; }
    struct PermitData { bool usePermit2; IPermit2.PermitTransferFrom permit; bytes signature; }

    constructor(address sourceToken_, address collateralToken_, address morphoBlue_, address oneInchRouter_, address permit2_, MarketParams memory marketParams_) {
        if (sourceToken_ == address(0) || collateralToken_ == address(0) || morphoBlue_ == address(0) || oneInchRouter_ == address(0) || permit2_ == address(0)) revert InvalidAddress();
        if (marketParams_.collateralToken != collateralToken_) revert InvalidMarket();
        sourceToken = sourceToken_; collateralToken = collateralToken_; morphoBlue = morphoBlue_; oneInchRouter = oneInchRouter_; permit2 = IPermit2(permit2_); marketParams = marketParams_;
    }

    modifier nonReentrant() { if (locked) revert Reentrant(); locked = true; _; locked = false; }

    function allocateToMorpho(AllocationRequest calldata request, PermitData calldata permitData) external nonReentrant returns (uint256 collateralSupplied) {
        if (block.timestamp > request.deadline) revert Expired();
        _pullSource(request.sourceAmount, permitData);
        _approve(sourceToken, oneInchRouter, request.sourceAmount);
        uint256 beforeBalance = IERC20(collateralToken).balanceOf(address(this));
        (bool ok,) = oneInchRouter.call(request.routerCalldata);
        if (!ok) revert RouterCallFailed();
        collateralSupplied = IERC20(collateralToken).balanceOf(address(this)) - beforeBalance;
        if (collateralSupplied < request.minCollateralAmount) revert SlippageExceeded(request.minCollateralAmount, collateralSupplied);

        _approve(collateralToken, morphoBlue, collateralSupplied);
        IMorphoBlue(morphoBlue).supplyCollateral(marketParams, collateralSupplied, msg.sender, "");
        uint256 remainder = IERC20(sourceToken).balanceOf(address(this));
        if (remainder != 0 && !IERC20(sourceToken).transfer(msg.sender, remainder)) revert TransferFailed();
        emit AllocatedToMorpho(msg.sender, request.reportHash, keccak256(abi.encode(marketParams)), request.sourceAmount, collateralSupplied);
    }

    function _pullSource(uint256 sourceAmount, PermitData calldata permitData) private {
        if (permitData.usePermit2) {
            if (permitData.permit.permitted.token != sourceToken || permitData.permit.permitted.amount < sourceAmount || permitData.permit.deadline < block.timestamp) revert InvalidPermit();
            permit2.permitTransferFrom(permitData.permit, IPermit2.SignatureTransferDetails({ to: address(this), requestedAmount: sourceAmount }), msg.sender, permitData.signature);
        } else if (!IERC20(sourceToken).transferFrom(msg.sender, address(this), sourceAmount)) revert TransferFailed();
    }

    function _approve(address token, address spender, uint256 amount) private {
        if (!IERC20(token).approve(spender, 0) || !IERC20(token).approve(spender, amount)) revert TransferFailed();
    }
}
