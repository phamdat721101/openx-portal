// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
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

/// @notice A fixed-market, non-custodial USDC collateral adapter for Morpho Blue.
/// @dev The configured USDC must be the selected market's collateral token.
contract OpenXAllocationZap {
    error InvalidAddress(); error InvalidMarket(); error InvalidPermit(); error Reentrant(); error TransferFailed();

    address public immutable usdc;
    address public immutable morphoBlue;
    IPermit2 public immutable permit2;
    MarketParams public marketParams;
    bool private locked;

    event AllocatedToMorpho(address indexed user, bytes32 indexed reportHash, bytes32 indexed marketId, uint256 usdcCollateralSupplied);

    struct AllocationRequest { uint256 usdcCollateralAmount; bytes32 reportHash; }
    struct PermitData { bool usePermit2; IPermit2.PermitTransferFrom permit; bytes signature; }

    constructor(address usdc_, address morphoBlue_, address permit2_, MarketParams memory marketParams_) {
        if (usdc_ == address(0) || morphoBlue_ == address(0) || permit2_ == address(0)) revert InvalidAddress();
        if (marketParams_.collateralToken != usdc_) revert InvalidMarket();
        usdc = usdc_; morphoBlue = morphoBlue_; permit2 = IPermit2(permit2_); marketParams = marketParams_;
    }

    modifier nonReentrant() { if (locked) revert Reentrant(); locked = true; _; locked = false; }

    function allocateToMorpho(AllocationRequest calldata request, PermitData calldata permitData) external nonReentrant returns (uint256 usdcCollateralSupplied) {
        _pullUsdc(request.usdcCollateralAmount, permitData);
        _approve(usdc, morphoBlue, request.usdcCollateralAmount);
        IMorphoBlue(morphoBlue).supplyCollateral(marketParams, request.usdcCollateralAmount, msg.sender, "");
        emit AllocatedToMorpho(msg.sender, request.reportHash, keccak256(abi.encode(marketParams)), request.usdcCollateralAmount);
        return request.usdcCollateralAmount;
    }

    function _pullUsdc(uint256 usdcCollateralAmount, PermitData calldata permitData) private {
        if (permitData.usePermit2) {
            if (permitData.permit.permitted.token != usdc || permitData.permit.permitted.amount < usdcCollateralAmount || permitData.permit.deadline < block.timestamp) revert InvalidPermit();
            permit2.permitTransferFrom(permitData.permit, IPermit2.SignatureTransferDetails({ to: address(this), requestedAmount: usdcCollateralAmount }), msg.sender, permitData.signature);
        } else if (!IERC20(usdc).transferFrom(msg.sender, address(this), usdcCollateralAmount)) revert TransferFailed();
    }

    function _approve(address token, address spender, uint256 amount) private {
        if (!IERC20(token).approve(spender, 0) || !IERC20(token).approve(spender, amount)) revert TransferFailed();
    }
}
