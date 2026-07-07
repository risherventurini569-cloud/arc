// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ArcSealRegistry.sol";

contract MockUSDC {
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => uint256) public balanceOf;
    function mint(address to, uint256 value) external { balanceOf[to] += value; }
    function approve(address spender, uint256 value) external returns (bool) { allowance[msg.sender][spender] = value; return true; }
    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        require(allowance[from][msg.sender] >= value, "allowance");
        require(balanceOf[from] >= value, "balance");
        allowance[from][msg.sender] -= value;
        balanceOf[from] -= value;
        balanceOf[to] += value;
        return true;
    }
}

contract ArcSealRegistryTest is Test {
    MockUSDC usdc;
    ArcSealRegistry registry;
    address issuer = address(0xA11CE);
    address treasury = address(0xBEEF);

    function setUp() public {
        usdc = new MockUSDC();
        registry = new ArcSealRegistry(address(usdc), treasury, 10_000);
        usdc.mint(issuer, 1_000_000);
    }

    function testSealAndVerify() public {
        bytes32 documentHash = sha256("test-document");
        bytes32 manifestHash = sha256("manifest");
        vm.startPrank(issuer);
        usdc.approve(address(registry), 10_000);
        registry.seal(documentHash, manifestHash, 0);
        vm.stopPrank();

        (address sealIssuer, uint64 sealedAt,, bool revoked, bytes32 recordedManifest) = registry.verify(documentHash);
        assertEq(sealIssuer, issuer);
        assertGt(sealedAt, 0);
        assertFalse(revoked);
        assertEq(recordedManifest, manifestHash);
        assertEq(usdc.balanceOf(treasury), 10_000);
    }
}
