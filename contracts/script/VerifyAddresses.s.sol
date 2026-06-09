// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";

interface IERC20Min {
    function decimals() external view returns (uint8);

    function symbol() external view returns (string memory);
}

interface IPythMin {
    function getValidTimePeriod() external view returns (uint256);
}

contract VerifyAddresses is Script {
    function run() external view {
        address usdc = vm.envAddress("USDC_ADDRESS");
        address pyth = vm.envAddress("PYTH_ADDRESS");
        address multicall3 = vm.envAddress("MULTICALL3_ADDRESS");

        uint8 usdcDecimals = IERC20Min(usdc).decimals();
        string memory usdcSymbol = IERC20Min(usdc).symbol();

        console2.log("=== USDC ===");
        console2.log("USDC decimals:", usdcDecimals);
        console2.log("USDC symbol:");
        console2.log(usdcSymbol);

        require(usdcDecimals == 6, "USDC decimals mismatch");
        require(
            keccak256(bytes(usdcSymbol)) == keccak256(bytes("USDC")),
            "USDC symbol mismatch"
        );

        uint256 validTimePeriod = IPythMin(pyth).getValidTimePeriod();

        console2.log("=== Pyth ===");
        console2.log("Pyth valid period:", validTimePeriod);

        require(validTimePeriod > 0, "Pyth valid period is zero");

        uint256 multicall3CodeSize;
        assembly {
            multicall3CodeSize := extcodesize(multicall3)
        }

        console2.log("=== Multicall3 ===");
        console2.log("Multicall3 code size:", multicall3CodeSize);

        require(multicall3CodeSize > 0, "Multicall3 not deployed");
    }
}
